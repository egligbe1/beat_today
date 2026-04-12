import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Maps license types to which file columns are accessible.
// mp3_preview_url is intentionally excluded — it points to the watermarked
// preview in the public bucket. Buyers always receive the clean file from
// the private beat-files bucket via file_mp3_url.
const LICENSE_FILE_ACCESS: Record<string, string[]> = {
  mp3:      ['file_mp3_url'],
  wav:      ['file_wav_url', 'file_mp3_url'],
  trackout: ['file_wav_url', 'file_stems_url', 'file_mp3_url'],
  exclusive:['file_wav_url', 'file_stems_url', 'file_mp3_url'],
}

// Maps file column name to its Supabase storage bucket
const FILE_BUCKETS: Record<string, string> = {
  file_mp3_url:   'beat-files',
  file_wav_url:   'beat-files',
  file_stems_url: 'beat-files',
}

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

    // 3. Determine which file column to use
    const FILE_COLUMN: Record<string, string> = { mp3: 'file_mp3_url', wav: 'file_wav_url', stems: 'file_stems_url' }
    const fileColumnKey = FILE_COLUMN[fileType]
    if (!fileColumnKey) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    const filePath: string | null = beat[fileColumnKey] ?? null
    if (!filePath) {
      return NextResponse.json({ error: 'File not available' }, { status: 404 })
    }

    // 4. Check license allows this file type
    const allowedFiles = LICENSE_FILE_ACCESS[licenseType] || []

    if (!allowedFiles.includes(fileColumnKey)) {
      return NextResponse.json({ error: 'Your license does not include this file type' }, { status: 403 })
    }

    // 5. Generate signed URL (1-hour expiry)
    // filePath might be a full public URL (for previews) or a storage path
    const bucket = FILE_BUCKETS[fileColumnKey]

    // Extract just the storage path from the URL if it's a full URL
    let storagePath = filePath
    if (filePath.startsWith('http')) {
      const urlObj = new URL(filePath)
      // Supabase storage path is after /storage/v1/object/public/<bucket>/
      const match = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/)
      if (match) {
        storagePath = match[1]
      } else {
        // It's a public URL, redirect directly
        return NextResponse.redirect(filePath)
      }
    }

    const { data: signedUrlData, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600) // 1 hour

    if (signError || !signedUrlData) {
      console.error('Signed URL error:', signError)
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      filename: `${beat.title || 'beat'}-${fileType}.${fileType === 'stems' ? 'zip' : fileType}`
    })
  } catch (err: any) {
    console.error('Download API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
