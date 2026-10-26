import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getObjectBuffer, putObject, listObjects, publicUrl, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET } from '@/lib/r2'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { randomUUID } from 'node:crypto'
import { ownsAsset, effectiveTier } from '@/lib/security'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const START_DELAY_S = 30      
const REPEAT_INTERVAL_S = 45  
const MAX_WATERMARKS = 3      

function getFfmpegPath(): string {
  return process.env.FFMPEG_PATH ? resolve(process.env.FFMPEG_PATH) : join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath()
    const proc = spawn(ffmpegPath, ['-i', filePath])
    const timer = setTimeout(() => proc.kill('SIGKILL'), 15000)
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-100000) })
    proc.on('close', () => {
      clearTimeout(timer)
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const h = parseInt(match[1]), m = parseInt(match[2]), s = parseInt(match[3]);
        resolve(h * 3600 + m * 60 + s);
      } else resolve(0);
    })
    proc.on('error', () => { clearTimeout(timer); resolve(0) })
  })
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath()
    const proc = spawn(ffmpegPath, args)
    proc.stderr.resume()
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Timeout')); }, 90000)
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited ${code}`))
    })
    proc.on('error', (err) => { clearTimeout(timer); reject(err) })

  })
}

export async function processWatermarkJob(beatId?: string) {
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_watermark_job', { p_beat: beatId || null })
  if (claimError) throw claimError
  const job = claimed?.[0]
  if (!job) return { skipped: true }
  const beat_id = job.beat_id
  const tempFiles: string[] = []
  try {
    const { data: beat, error } = await supabaseAdmin.from('beats')
      .select('id, producer_id, file_mp3_url, file_wav_url, status, is_exclusive_sold').eq('id', beat_id).single()
    if (error || !beat) throw error || new Error('Beat missing')
    const storage_path = beat.file_wav_url || beat.file_mp3_url
    if (!ownsAsset(storage_path, beat.producer_id, 'master')) throw new Error('Master ownership invalid')
    // 2. Determine Pro Status & Custom Tag
    const { data: settings } = await supabaseAdmin
      .from('producer_settings')
      .select('subscription_tier, subscription_active, subscription_expires_at')
      .eq('user_id', beat.producer_id)
      .single()
    
    const isPro = effectiveTier(settings) === 'PRO'
    let proTagPath: string | null = null

    if (isPro) {
      const tagKey = `producer-tags/${beat.producer_id}/tag.mp3`
      const tagKeys = await listObjects(R2_PUBLIC_BUCKET, tagKey)
      if (tagKeys.includes(tagKey)) proTagPath = tagKey
    }

    await supabaseAdmin.from('beats').update({ watermark_status: 'processing' }).eq('id', beat_id)

    const id = randomUUID()
    const tmpIn  = join(tmpdir(), `bt-${id}-in.mp3`); tempFiles.push(tmpIn);
    const tmpOut = join(tmpdir(), `bt-${id}-out.mp3`); tempFiles.push(tmpOut);

    // Download the clean master from the private R2 bucket
    const beatBuffer = await getObjectBuffer(R2_PRIVATE_BUCKET, storage_path)
    if (!beatBuffer?.length) throw new Error('Source file not found')
    await writeFile(tmpIn, beatBuffer)

    const duration = await getAudioDuration(tmpIn);
    const times: number[] = [];
    for (let t = START_DELAY_S; t < duration && times.length < MAX_WATERMARKS; t += REPEAT_INTERVAL_S) {
      times.push(t);
    }
    if (times.length === 0) times.push(0);

    const inputs: string[] = ['-i', tmpIn]
    const filterParts: string[] = []
    const delayLabels: string[] = []

    // 3. Selection of Tags
    // If PRO and has custom tag, use it exclusively. Else use random global tags.
    let globalTags: string[] = []
    if (!proTagPath) {
      globalTags = (await listObjects(R2_PUBLIC_BUCKET, '_watermark/')).filter(k => k.endsWith('.mp3'))
    }

    for (let i = 0; i < times.length; i++) {
      const tagPath = join(tmpdir(), `bt-${id}-tag-${i}.mp3`);
      tempFiles.push(tagPath);

      let tagKey = ''
      if (proTagPath) {
        tagKey = proTagPath
      } else if (globalTags.length > 0) {
        tagKey = globalTags[Math.floor(Math.random() * globalTags.length)]
      }

      let tagBuffer: Buffer | null = null
      if (tagKey) {
        try { tagBuffer = await getObjectBuffer(R2_PUBLIC_BUCKET, tagKey) } catch { tagBuffer = null }
      }

      if (tagBuffer?.length) {
        await writeFile(tagPath, tagBuffer)
        inputs.push('-i', tagPath)
      } else {
        // No tag available — fall back to a short beep so the beat is still tagged.
        await runFfmpeg(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', '-codec:a', 'libmp3lame', '-y', tagPath])
        inputs.push('-i', tagPath)
      }

      const ms = times[i] * 1000
      filterParts.push(`[${i + 1}:a]adelay=${ms}:all=1[tag${i}]`)
      delayLabels.push(`[tag${i}]`)
    }

    filterParts.push(`${delayLabels.join('')}amix=inputs=${times.length}:duration=longest:normalize=0[tagall]`)
    filterParts.push(`[0:a][tagall]amix=inputs=2:duration=first:weights=1 1.2:normalize=0[out]`)

    await runFfmpeg([...inputs, '-filter_complex', filterParts.join(';'), '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '4', '-y', tmpOut])

    const outBuffer = await readFile(tmpOut)
    const previewKey = `previews/${beat.producer_id}/${beat_id}-${id}.mp3`
    await putObject(R2_PUBLIC_BUCKET, previewKey, outBuffer, 'audio/mpeg')
    const previewUrl = publicUrl(previewKey)

    // Ignore stale workers if a producer replaced the source during processing.
    const { data: currentJob } = await supabaseAdmin.from('watermark_jobs').select('claimed_at').eq('id', job.id).single()
    if (currentJob?.claimed_at !== job.claimed_at) return { skipped: true }
    const sourceColumn = beat.file_wav_url ? 'file_wav_url' : 'file_mp3_url'
    const { error: beatError } = await supabaseAdmin.from('beats').update({
      mp3_preview_url: previewUrl, watermark_status: 'done',
      ...(beat.status === 'pending' && !beat.is_exclusive_sold ? { status: 'active' } : {}),
    }).eq('id', beat_id).eq(sourceColumn, storage_path).eq('status', beat.status)
    if (beatError) throw beatError
    const { error: jobError } = await supabaseAdmin.from('watermark_jobs').update({ status: 'done', processed_at: new Date().toISOString(), error: null }).eq('id', job.id).eq('claimed_at', job.claimed_at)
    if (jobError) throw jobError
    return { success: true }
  } catch (err: any) {
    console.error('Watermark processing failed', { beat_id, error: err })
    const { data: failed, error } = await supabaseAdmin.from('watermark_jobs').update({ status: 'failed', error: String(err.message).slice(0, 500) }).eq('id', job.id).eq('claimed_at', job.claimed_at).select('beat_id').maybeSingle()
    if (error) console.error('Watermark retry status failed', error)
    if (failed) await supabaseAdmin.from('beats').update({ watermark_status: 'failed' }).eq('id',beat_id).eq('watermark_status','processing')
    return { success: false }

  } finally {
    for (const f of tempFiles) await unlink(f).catch(() => {})
  }
}
