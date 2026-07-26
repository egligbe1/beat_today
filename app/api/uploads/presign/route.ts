import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { presignUpload, publicUrl, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET } from '@/lib/r2'

// POST /api/uploads/presign
// Body: { purpose, beatId?, ext, contentType }
// Returns a presigned PUT URL so the browser can upload large files directly
// to R2 (bypassing the 4.5MB serverless body limit). The object key is built
// server-side from the authenticated user id, so a client can only ever write
// under its own prefix.
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { purpose, beatId, ext, contentType } = await req.json()

  const safeExt = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin'
  const safeBeatId = String(beatId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40)
  const type = String(contentType || 'application/octet-stream').slice(0, 100)
  const ts = Date.now()

  let bucket: string
  let key: string
  let isPublic: boolean

  switch (purpose) {
    case 'cover':
      if (!safeBeatId) return NextResponse.json({ error: 'beatId required' }, { status: 400 })
      bucket = R2_PUBLIC_BUCKET; isPublic = true
      key = `covers/${user.id}/${safeBeatId}-${ts}.webp`
      break
    case 'master':
      if (!safeBeatId) return NextResponse.json({ error: 'beatId required' }, { status: 400 })
      bucket = R2_PRIVATE_BUCKET; isPublic = false
      key = `masters/${user.id}/${safeBeatId}-clean.${safeExt === 'wav' ? 'wav' : 'mp3'}`
      break
    case 'stems':
      if (!safeBeatId) return NextResponse.json({ error: 'beatId required' }, { status: 400 })
      bucket = R2_PRIVATE_BUCKET; isPublic = false
      key = `stems/${user.id}/${safeBeatId}-stems.zip`
      break
    case 'avatar':
      bucket = R2_PUBLIC_BUCKET; isPublic = true
      key = `avatars/${user.id}-${ts}.${safeExt}`
      break
    case 'producerTag':
      bucket = R2_PUBLIC_BUCKET; isPublic = true
      key = `producer-tags/${user.id}/tag.mp3`
      break
    default:
      return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 })
  }

  try {
    const uploadUrl = await presignUpload(bucket, key, type)
    return NextResponse.json({
      uploadUrl,
      key,
      bucket,
      publicUrl: isPublic ? publicUrl(key) : null,
    })
  } catch (err) {
    console.error('presign error:', err)
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 })
  }
}
