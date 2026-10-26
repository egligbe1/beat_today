import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
export async function PATCH(request: Request,{params}:{params:Promise<{id:string}>}) {
  const {data:{user}}=await (await createClient()).auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const {status,amount,message}=await request.json()
  const {data,error}=await createAdminClient().rpc('transition_offer',{
    p_offer:(await params).id,p_user:user.id,p_status:status,p_amount:amount ? Number(amount) : null,p_message:typeof message==='string'?message.slice(0,2000):null,
  })
  if(error)return NextResponse.json({error:'Offer transition unavailable'},{status:409})
  return NextResponse.json({offer:data})
}
