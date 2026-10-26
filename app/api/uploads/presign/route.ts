import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { presignUpload, publicUrl, R2_PUBLIC_BUCKET, R2_PRIVATE_BUCKET } from '@/lib/r2'
import { randomUUID } from 'node:crypto'
import { UUID_RE, effectiveTier } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'

// POST /api/uploads/presign
// Body: { purpose, beatId?, ext, contentType }
// Returns a presigned PUT URL so the browser can upload large files directly
// to R2 (bypassing the 4.5MB serverless body limit). The object key is built
// server-side from the authenticated user id, so a client can only ever write
// under its own prefix.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await rateLimit(`uploads:${user.id}`, 20, 60)) return NextResponse.json({ error: 'Please wait' }, { status: 429 })

  const { purpose, beatId, ext, contentType, size } = await req.json()
  const { data: profile } = await supabase.from('users_profiles').select('role').eq('id', user.id).single()
  const { data: settings } = await supabase.from('producer_settings').select('subscription_tier,subscription_active,subscription_expires_at').eq('user_id', user.id).maybeSingle()
  const tier = effectiveTier(settings)
  if (purpose !== 'avatar' && profile?.role !== 'producer') return NextResponse.json({ error: 'Producer account required' }, { status: 403 })
  if ((purpose === 'stems' || purpose === 'producerTag') && tier !== 'PRO') return NextResponse.json({ error: 'PRO is required' }, { status: 403 })
  if (purpose === 'master' && ext === 'wav' && tier === 'FREE') return NextResponse.json({ error: 'STARTER is required for WAV' }, { status: 403 })
  const maxSize = purpose === 'stems' ? 1024 * 1024 * 1024 : purpose === 'master' ? 250 * 1024 * 1024 : 10 * 1024 * 1024
  if (!Number.isSafeInteger(size) || size < 1 || size > maxSize) return NextResponse.json({ error: 'File size exceeds this upload limit' }, { status: 400 })
  const allowedTypes: Record<string, string[]> = { cover: ['image/webp'], avatar: ['image/webp','image/jpeg','image/png'], master: ['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave'], stems: ['application/zip','application/x-zip-compressed'], producerTag: ['audio/mpeg','audio/mp3'] }
  if (!allowedTypes[purpose]?.includes(contentType)) return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  if (['cover','master','stems'].includes(purpose)) {
    if (!UUID_RE.test(beatId || '')) return NextResponse.json({ error: 'Valid beatId required' }, { status: 400 })
    const { data: beat } = await supabase.from('beats').select('producer_id').eq('id', beatId).single()
    if (beat?.producer_id !== user.id) return NextResponse.json({ error: 'Save your draft before uploading files' }, { status: 403 })
  }

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
      key = `masters/${user.id}/${safeBeatId}-${randomUUID()}.${safeExt === 'wav' ? 'wav' : 'mp3'}`
      break
    case 'stems':
      if (!safeBeatId) return NextResponse.json({ error: 'beatId required' }, { status: 400 })
      bucket = R2_PRIVATE_BUCKET; isPublic = false
      key = `stems/${user.id}/${safeBeatId}-${randomUUID()}.zip`
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
    const uploadUrl = await presignUpload(bucket, key, type, 600, size)
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
