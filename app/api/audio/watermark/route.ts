import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processWatermarkJob } from '@/lib/audio/watermarkWorker'
import { UUID_RE } from '@/lib/security'
export async function POST(request: Request) {
  const { beat_id } = await request.json()
  if (!UUID_RE.test(beat_id || '')) return NextResponse.json({error:'Invalid beat'},{status:400})
  const internal = !!process.env.CRON_SECRET && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!internal) {
    const {data:{user}}=await (await createClient()).auth.getUser()
    const {data:beat}=await createAdminClient().from('beats').select('producer_id').eq('id',beat_id).single()
    if(!user || beat?.producer_id!==user.id) return NextResponse.json({error:'Unauthorized'},{status:401})
  }
  return NextResponse.json(await processWatermarkJob(beat_id))
}
