import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'
import { payoutAccount, payoutBank } from '@/lib/payoutValidation'
import { safeRequestError } from '@/lib/http'
const headers={'Cache-Control':'private, no-store'}
export async function GET(req:Request){
 try{
  const db=await createClient(),{data:{user}}=await db.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401,headers})
  const {data:profile,error}=await db.from('users_profiles').select('role').eq('id',user.id).single()
  if(error)throw error
  if(profile?.role!=='producer')return NextResponse.json({error:'Producer account required'},{status:403,headers})
  if(!await rateLimit('verify-bank:'+user.id,10,60))return NextResponse.json({error:'Please wait before verifying another account'},{status:429,headers})
  const params=new URL(req.url).searchParams,account=payoutAccount(params.get('account_number')),bank=payoutBank(params.get('bank_code'))
  const secret=process.env.PAYSTACK_SECRET_KEY
  if(!secret)throw new Error('Provider unavailable')
  const response=await fetch('https://api.paystack.co/bank/resolve?'+new URLSearchParams({account_number:account,bank_code:bank}),{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(15000),cache:'no-store'})
  const data=await response.json()
  if(!response.ok||!data.status||typeof data.data?.account_name!=='string')return NextResponse.json({success:false,error:'Could not verify account. Please check your details.'},{status:400,headers})
  return NextResponse.json({success:true,account_name:data.data.account_name,account_number:data.data.account_number},{headers})
 }catch(error){const e=safeRequestError(error,'Account verification is unavailable. Please try again.');return NextResponse.json({success:false,error:e.message},{status:e.status,headers})}
}
