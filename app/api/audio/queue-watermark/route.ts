import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownsAsset, UUID_RE } from '@/lib/security'
import { rateLimit } from '@/lib/rateLimit'
import { processWatermarkJob } from '@/lib/audio/watermarkWorker'
export async function POST(request: Request) {
  const {data:{user}}=await (await createClient()).auth.getUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  if(!await rateLimit(`watermark:${user.id}`,5,60)) return NextResponse.json({error:'Please wait'},{status:429})
  const {beat_id}=await request.json()
  if(!UUID_RE.test(beat_id || '')) return NextResponse.json({error:'Invalid beat'},{status:400})
  const admin=createAdminClient()
  const {data:beat,error}=await admin.from('beats').select('producer_id,file_mp3_url,file_wav_url').eq('id',beat_id).single()
  if(error || beat?.producer_id!==user.id) return NextResponse.json({error:'Beat not found'},{status:404})
  const source=beat.file_wav_url || beat.file_mp3_url
  if(!ownsAsset(source,user.id,'master')) return NextResponse.json({error:'Invalid source'},{status:403})
  const {error:queued}=await admin.rpc('enqueue_watermark',{p_beat:beat_id,p_source:source})
  if(queued) {console.error('Queue failed',queued);return NextResponse.json({error:'Unable to queue preview'},{status:500})}
  after(()=>processWatermarkJob(beat_id).then(()=>{}))
  return NextResponse.json({success:true})
}
