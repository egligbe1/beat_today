import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Producers upload ONE clean master (MP3 or WAV). It lands in file_mp3_url or
// file_wav_url depending on its real format. Any purchased license grants the
// clean audio; stems are reserved for trackout/exclusive.
const STEMS_LICENSES = new Set(['trackout', 'exclusive'])

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const beatId = searchParams.get('beat_id')
    const fileType = searchParams.get('file') // 'mp3' | 'wav' | 'stems'
    const orderId = searchParams.get('order_id')

    if (!beatId || !fileType || !orderId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 1. Verify user is authenticated
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify user owns this order and the beat is in it
    const { data: orderItem } = await supabaseAdmin
      .from('order_items')
      .select('license_type, beats(file_mp3_url, file_wav_url, file_stems_url, title)')
      .eq('beat_id', beatId)
      .eq('order_id', orderId)
      .single()

    if (!orderItem) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 403 })
    }

    // Verify order belongs to this user
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('buyer_id, status')
      .eq('id', orderId)
      .single()

    if (!order || order.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    if (order.status !== 'completed') {
      return NextResponse.json({ 
        error: 'Order still processing. Please wait a few moments for verification to complete.' 
      }, { status: 422 }) // Unprocessable Entity
    }

    const licenseType = orderItem.license_type as string
    const beat = orderItem.beats as any

    // 3. Resolve the file path for what was requested.
    //  - 'stems' → the stems ZIP, only for trackout/exclusive licenses.
    //  - anything else (audio) → the single clean master, whichever format the
    //    producer uploaded (WAV preferred over MP3). Granted to every license.
    let filePath: string | null = null
    if (fileType === 'stems') {
      if (!STEMS_LICENSES.has(licenseType)) {
        return NextResponse.json({ error: 'Your license does not include stems' }, { status: 403 })
      }
      filePath = beat.file_stems_url ?? null
    } else {
      filePath = beat.file_wav_url ?? beat.file_mp3_url ?? null
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 })
    }

    // 4. Generate signed URL (1-hour expiry).
    // filePath may be a full public URL (legacy) or a storage path.
    let storagePath = filePath
    if (filePath.startsWith('http')) {
      const urlObj = new URL(filePath)
      // Supabase storage path is after /storage/v1/object/public|sign/<bucket>/
      const match = /\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/.exec(urlObj.pathname)
      if (match) {
        storagePath = match[1]
      } else {
        return NextResponse.redirect(filePath)
      }
    }

    const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
      .from('beat-files')
      .createSignedUrl(storagePath, 3600) // 1 hour

    if (signError || !signedUrlData) {
      console.error('Signed URL error:', signError)
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
    }

    // Filename uses the actual stored extension so a WAV master isn't mislabeled.
    const ext = fileType === 'stems' ? 'zip' : (storagePath.split('.').pop() || 'mp3').toLowerCase()
    return NextResponse.json({
      url: signedUrlData.signedUrl,
      filename: `${beat.title || 'beat'}.${ext}`,
    })
  } catch (err: any) {
    console.error('Download API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
