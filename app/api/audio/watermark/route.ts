import { readJsonObject, safeRequestError } from '@/lib/http'
import { rateLimit } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWatermarkJob } from '@/lib/audio/watermarkWorker'
import { UUID_RE } from '@/lib/security'
export async function POST(request: Request) {
  let body
  try{body=await readJsonObject(request,2000)}catch(error){const e=safeRequestError(error);return NextResponse.json({error:e.message},{status:e.status})}
  const beat_id=typeof body.beat_id==='string'?body.beat_id:''
  if (!UUID_RE.test(beat_id || '')) return NextResponse.json({error:'Invalid beat'},{status:400})
  const internal = !!process.env.CRON_SECRET && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!internal) {
    const {data:{user}}=await (await createClient()).auth.getUser()
    if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
    if(!await rateLimit('watermark:'+user.id,5,60))return NextResponse.json({error:'Please wait'},{status:429})
    const {data:beat}=await createAdminClient().from('beats').select('producer_id').eq('id',beat_id).single()
    if(!user || beat?.producer_id!==user.id) return NextResponse.json({error:'Unauthorized'},{status:401})
  }
  return NextResponse.json(await processWatermarkJob(beat_id))
}
