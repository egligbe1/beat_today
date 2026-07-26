import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { presignDownload } from '@/lib/r2'

// Service-role client — used to look up the beat and record the audience row
// regardless of RLS. Never expose this key client-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/downloads/free — lead-gated download for FREE beats only.
export async function POST(request: Request) {
  try {
    const { beat_id, email, name } = await request.json()

    if (!beat_id || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!EMAIL_RE.test(String(email))) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    // 1. Authoritatively confirm the beat exists AND is actually free.
    //    producer_id is derived from the record, never trusted from the client.
    const { data: beat } = await supabaseAdmin
      .from('beats')
      .select('id, title, producer_id, is_free, status, file_mp3_url, file_wav_url, watermarked_preview_url')
      .eq('id', beat_id)
      .single()

    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }
    if (!beat.is_free) {
      // Never hand out a master for a paid beat through the free gate.
      return NextResponse.json({ error: 'This beat is not available for free download' }, { status: 403 })
    }

    // 2. Capture the lead (ignore duplicates — the producer already has them).
    await supabaseAdmin.from('producer_audiences').insert({
      producer_id: beat.producer_id,
      fan_email: String(email).toLowerCase().trim(),
      fan_name: name ? String(name).trim() : null,
      beat_id,
      source: 'FREE_DOWNLOAD',
    })

    // 3. Sign a short-lived URL for the free master (MP3 or WAV — whichever
    //    format the producer uploaded as their clean file).
    const cleanFile = beat.file_mp3_url ?? beat.file_wav_url
    if (!cleanFile) {
      return NextResponse.json({ error: 'Download file is not available' }, { status: 404 })
    }

    try {
      const ext = (cleanFile.split('.').pop() || 'mp3').toLowerCase()
      const url = await presignDownload(cleanFile, {
        expiresIn: 60 * 10, // 10 minutes
        filename: `${beat.title || 'beat'}.${ext}`,
      })
      return NextResponse.json({ success: true, url })
    } catch (err) {
      console.error('Free download sign error:', err)
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
    }
  } catch (error) {
    console.error('Free download error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
