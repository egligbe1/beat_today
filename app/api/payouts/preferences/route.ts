import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
export async function POST(request: Request) {
  const { data:{user} } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  const admin=createAdminClient()
  const {data:profile}=await admin.from('users_profiles').select('role').eq('id',user.id).single()
  if(profile?.role!=='producer') return NextResponse.json({error:'Producer account required'},{status:403})
  const {bank_details:bd}=await request.json()
  if(!bd || !['bank','mobile_money'].includes(bd.default_payout)) return NextResponse.json({error:'Invalid payout preferences'},{status:400})
  const {error}=await admin.rpc('save_payout_preferences',{p_user:user.id,p_details:bd})
  if(error){console.error('Payout preferences failed',error);return NextResponse.json({error:'Unable to save preferences'},{status:500})}
  return NextResponse.json({success:true})
}
