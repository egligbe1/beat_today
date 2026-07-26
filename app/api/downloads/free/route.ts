import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Service-role client — required to read the private `beat-files` bucket and to
// insert audience rows regardless of RLS. Never expose this key client-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Derive the storage object path (relative to the bucket) from whatever is
// stored in file_mp3_url — a bare key, a nested path, or a full URL.
function deriveObjectPath(stored: string, bucket: string): string {
  const marker = `/${bucket}/`
  const idx = stored.indexOf(marker)
  if (idx !== -1) return stored.slice(idx + marker.length).split('?')[0]
  // Not a full URL containing the bucket — treat as an object key as-is
  // (preserving any nested folders), dropping any leading slash.
  return stored.replace(/^\/+/, '').split('?')[0]
}

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
      .select('id, title, producer_id, is_free, status, file_mp3_url, watermarked_preview_url')
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

    // 3. Sign a short-lived URL for the free master.
    if (!beat.file_mp3_url) {
      return NextResponse.json({ error: 'Download file is not available' }, { status: 404 })
    }
    const objectPath = deriveObjectPath(beat.file_mp3_url, 'beat-files')

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('beat-files')
      .createSignedUrl(objectPath, 60 * 10) // 10-minute expiry

    if (signError || !signed?.signedUrl) {
      console.error('Free download sign error:', signError)
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: signed.signedUrl })
  } catch (error) {
    console.error('Free download error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
