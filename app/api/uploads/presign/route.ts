import {readJsonObject,safeRequestError} from '@/lib/http'
import {uploadMetadata,uploadPlanAllowed} from '@/lib/uploads'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { presignUpload, R2_PRIVATE_BUCKET } from '@/lib/r2'
import {issueUploadTicket} from '@/lib/uploads/ticket'
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

  let metadata
  try{const body=await readJsonObject(req);if(body.verification_version!==1)return NextResponse.json({error:'Refresh this page before uploading so your file can be verified.'},{status:409});metadata=uploadMetadata(body)}catch(error){const failure=safeRequestError(error);return NextResponse.json({error:failure.message},{status:failure.status})}
  const {purpose,beatId,ext,contentType,size}=metadata
  const { data: profile } = await supabase.from('users_profiles').select('role').eq('id', user.id).single()
  const { data: settings } = await supabase.from('producer_settings').select('subscription_tier,subscription_active,subscription_expires_at').eq('user_id', user.id).maybeSingle()
  const tier = effectiveTier(settings)
  if (purpose !== 'avatar' && profile?.role !== 'producer') return NextResponse.json({ error: 'Producer account required' }, { status: 403 })
  if(!uploadPlanAllowed(purpose,ext,tier))return NextResponse.json({error:purpose==='master'?'STARTER is required for WAV':'PRO is required'},{status:403})
  if (['cover','master','stems'].includes(purpose)) {
    if (!UUID_RE.test(typeof beatId==='string'?beatId:'')) return NextResponse.json({ error: 'Valid beatId required' }, { status: 400 })
    const { data: beat } = await supabase.from('beats').select('producer_id').eq('id', beatId).single()
    if (beat?.producer_id !== user.id) return NextResponse.json({ error: 'Save your draft before uploading files' }, { status: 403 })
  }

  try {
    const {token,upload}=issueUploadTicket(metadata,user.id,process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!)
    const uploadUrl = await presignUpload(R2_PRIVATE_BUCKET,upload.source,contentType,600,size)
    return NextResponse.json({uploadUrl,ticket:token},{headers:{'Cache-Control':'private, no-store'}})
  } catch (err) {
    console.error('presign error:', err)
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 })
  }
}
