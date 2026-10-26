import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/security'
import { rateLimit,requestAddress } from '@/lib/rateLimit'
export async function POST(request:Request,{params}:{params:Promise<{beatId:string}>}) {
  const {beatId}=await params
  if(!UUID_RE.test(beatId))return NextResponse.json({error:'Invalid beat'},{status:400})
  if(!await rateLimit(`play:${requestAddress(request)}:${beatId}`,1,60))return NextResponse.json({ok:true})
  const admin=createAdminClient()
  const {data:beat}=await admin.from('beats').select('id').eq('id',beatId).eq('status','active').maybeSingle()
  if(!beat)return NextResponse.json({error:'Beat unavailable'},{status:404})
  const {error}=await admin.rpc('increment_beat_play_count',{beat_id:beatId})
  if(error)return NextResponse.json({error:'Unable to count play'},{status:500})
  return NextResponse.json({ok:true})
}
