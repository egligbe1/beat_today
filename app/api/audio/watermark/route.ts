import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getObjectBuffer, putObject, listObjects, publicUrl, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET } from '@/lib/r2'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const START_DELAY_S = 30      
const REPEAT_INTERVAL_S = 45  
const MAX_WATERMARKS = 3      

function getFfmpegPath(): string {
  // If explicitly set, use it
  if (process.env.FFMPEG_PATH) return resolve(process.cwd(), process.env.FFMPEG_PATH)
  
  // On Linux (Render), 'ffmpeg' is usually in the PATH.
  // We can just return 'ffmpeg' and let the shell find it.
  if (process.platform === 'linux') return 'ffmpeg'

  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
  
  // 1. Try node_modules fallback for local dev
  return join(process.cwd(), 'node_modules', 'ffmpeg-static', binaryName)
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath()
    const proc = spawn(ffmpegPath, ['-i', filePath])
    let stderr = ''
    proc.stderr.on('data', (d) => stderr += d.toString())
    proc.on('close', () => {
      const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const h = parseInt(match[1]), m = parseInt(match[2]), s = parseInt(match[3]);
        resolve(h * 3600 + m * 60 + s);
      } else resolve(0);
    })
    proc.on('error', () => resolve(0))
  })
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath()
    const proc = spawn(ffmpegPath, args)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited ${code}`))
    })
    proc.on('error', (err) => reject(err))
    setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Timeout')); }, 90000);
  })
}

export async function POST(req: Request) {
  let inner_beat_id: string | null = null;
  const tempFiles: string[] = [];

  try {
    const body = await req.json()
    const { beat_id, storage_path } = body
    inner_beat_id = beat_id;

    if (!beat_id || !storage_path) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

    // 1. Fetch Beat & Producer details for priority logic
    const { data: beat } = await supabaseAdmin
      .from('beats')
      .select('id, producer_id')
      .eq('id', beat_id)
      .single()

    if (!beat) throw new Error('Beat record not found')

    // Auth check. The internal (cron/queue) bypass requires a configured
    // CRON_SECRET — never a guessable default, which would let anyone trigger
    // expensive FFmpeg jobs on any beat.
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isInternal = !!cronSecret && authHeader === `Bearer ${cronSecret}`
    if (!isInternal) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || user.id !== beat.producer_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Determine Pro Status & Custom Tag
    const { data: settings } = await supabaseAdmin
      .from('producer_settings')
      .select('subscription_tier')
      .eq('user_id', beat.producer_id)
      .single()
    
    const isPro = settings?.subscription_tier?.toUpperCase() === 'PRO'
    let proTagPath: string | null = null

    if (isPro) {
      const tagKey = `producer-tags/${beat.producer_id}/tag.mp3`
      const tagKeys = await listObjects(R2_PUBLIC_BUCKET, tagKey)
      if (tagKeys.includes(tagKey)) proTagPath = tagKey
    }

    await supabaseAdmin.from('beats').update({ watermark_status: 'processing' }).eq('id', beat_id)

    const id = beat_id.slice(0, 8)
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
    const previewKey = `previews/${beat.producer_id}/${beat_id}.mp3`
    await putObject(R2_PUBLIC_BUCKET, previewKey, outBuffer, 'audio/mpeg')
    const previewUrl = publicUrl(previewKey)

    await Promise.all([
      supabaseAdmin.from('beats').update({
        mp3_preview_url: previewUrl,
        watermark_status: 'done',
        status: 'active' // IMPORTANT: Switch from pending to active
      }).eq('id', beat_id),
      supabaseAdmin.from('watermark_jobs').update({ status: 'done', processed_at: new Date().toISOString() }).eq('beat_id', beat_id)
    ])

    return NextResponse.json({ success: true, preview_url: previewUrl })

  } catch (err: any) {
    const envInfo = `[Platform: ${process.platform}, Arch: ${process.arch}, Path: ${getFfmpegPath()}]`
    console.error(`[WATERMARK] ${envInfo} Error:`, err)
    if (inner_beat_id) {
      await supabaseAdmin.from('beats').update({ watermark_status: 'failed' }).eq('id', inner_beat_id)
      await supabaseAdmin.from('watermark_jobs').update({ 
        status: 'failed', 
        error: `${envInfo} ${err.message}` 
      }).eq('beat_id', inner_beat_id)
    }
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  } finally {
    for (const f of tempFiles) await unlink(f).catch(() => {})
  }
}
