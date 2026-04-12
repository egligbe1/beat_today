import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { verifyQStashSignature } from '@/lib/qstash'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const START_DELAY_S = 30
const REPEAT_INTERVAL_S = 45
const MAX_WATERMARKS = 3

function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH) return resolve(process.cwd(), process.env.FFMPEG_PATH)
  const isWin = process.platform === 'win32'
  const binaryName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
  
  // 1. Try node_modules
  const nodePath = join(process.cwd(), 'node_modules', 'ffmpeg-static', binaryName)
  
  // 2. Try common system paths or just the binary name
  return nodePath
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
  const isValid = await verifyQStashSignature(req.clone())
  if (!isValid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: jobs } = await supabaseAdmin
    .from('watermark_jobs')
    .select('*, beats(id, producer_id, storage_path)')
    .eq('status', 'pending')
    .limit(3)

  if (!jobs?.length) return NextResponse.json({ message: 'No pending jobs' })

  const results = []
  for (const job of jobs) {
    const tempFiles: string[] = []
    try {
      const beat = job.beats
      if (!beat) throw new Error('Beat not found for job')

      // PRO CHECK
      const { data: settings } = await supabaseAdmin
        .from('producer_settings')
        .select('subscription_tier')
        .eq('user_id', beat.producer_id)
        .single()
      
      const isPro = settings?.subscription_tier?.toUpperCase() === 'PRO'
      let proTagPath: string | null = null

      if (isPro) {
        const { data: tagFiles } = await supabaseAdmin.storage
          .from('beat-previews')
          .list(`producer-tags/${beat.producer_id}`)
        const customTag = tagFiles?.find(f => f.name.toLowerCase() === 'tag.mp3')
        if (customTag) proTagPath = `producer-tags/${beat.producer_id}/tag.mp3`
      }

      const id = beat.id.slice(0,8)
      const tmpIn = join(tmpdir(), `cron-in-${id}.mp3`); tempFiles.push(tmpIn)
      const tmpOut = join(tmpdir(), `cron-out-${id}.mp3`); tempFiles.push(tmpOut)

      const { data: bFile } = await supabaseAdmin.storage.from('beat-files').download(beat.storage_path)
      if (!bFile) throw new Error('Source not found')
      await writeFile(tmpIn, Buffer.from(await bFile.arrayBuffer()))

      const duration = await getAudioDuration(tmpIn)
      const times: number[] = []
      for (let t = START_DELAY_S; t < duration && times.length < MAX_WATERMARKS; t += REPEAT_INTERVAL_S) {
        times.push(t)
      }
      if (times.length === 0) times.push(0)

      let globalTags: any[] = []
      if (!proTagPath) {
        const { data: gf } = await supabaseAdmin.storage.from('beat-previews').list('_watermark')
        globalTags = gf?.filter(f => f.name.endsWith('.mp3')) || []
      }

      const inputs = ['-i', tmpIn]
      const filterParts = []
      const delayLabels = []

      for (let i = 0; i < times.length; i++) {
        const tagFile = join(tmpdir(), `cron-tag-${id}-${i}.mp3`); tempFiles.push(tagFile)
        let downloadPath = ''
        if (proTagPath) {
          downloadPath = proTagPath
        } else {
          const tagToUse = globalTags.length > 0 ? globalTags[Math.floor(Math.random() * globalTags.length)].name : 'voice.mp3'
          downloadPath = `_watermark/${tagToUse}`
        }

        const { data: vFile } = await supabaseAdmin.storage.from('beat-previews').download(downloadPath)
        if (vFile) {
          await writeFile(tagFile, Buffer.from(await vFile.arrayBuffer()))
        } else {
          await runFfmpeg(['-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', '-codec:a', 'libmp3lame', '-y', tagFile])
        }
        inputs.push('-i', tagFile)
        const ms = times[i] * 1000
        filterParts.push(`[${i + 1}:a]adelay=${ms}:all=1[tag${i}]`)
        delayLabels.push(`[tag${i}]`)
      }

      filterParts.push(`${delayLabels.join('')}amix=inputs=${times.length}:duration=longest:normalize=0[tagall]`)
      filterParts.push(`[0:a][tagall]amix=inputs=2:duration=first:weights=1 1.2:normalize=0[out]`)

      await runFfmpeg([...inputs, '-filter_complex', filterParts.join(';'), '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '4', '-y', tmpOut])

      const watermarkedPath = `watermarked/${beat.producer_id}/${beat.id}.mp3`
      await supabaseAdmin.storage.from('beat-previews').upload(watermarkedPath, await readFile(tmpOut), { contentType: 'audio/mpeg', upsert: true })
      const { data: { publicUrl } } = supabaseAdmin.storage.from('beat-previews').getPublicUrl(watermarkedPath)

      await Promise.all([
        supabaseAdmin.from('beats').update({ mp3_preview_url: publicUrl, watermark_status: 'done' }).eq('id', beat.id),
        supabaseAdmin.from('watermark_jobs').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', job.id)
      ])
      results.push({ id: job.id, success: true })
    } catch (err: any) {
      console.error('[CRON ERROR]', err)
      const beatId = job.beats?.id
      if (beatId) {
        await supabaseAdmin.from('beats').update({ watermark_status: 'failed' }).eq('id', beatId)
      }
      await supabaseAdmin.from('watermark_jobs').update({ status: 'failed', error: err.message }).eq('id', job.id)
      results.push({ id: job.id, success: false, error: err.message })
    } finally {
      for (const f of tempFiles) await unlink(f).catch(() => {})
    }
  }

  return NextResponse.json({ results })
}
