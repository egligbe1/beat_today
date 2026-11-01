import {NextResponse} from 'next/server'
import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {readJsonObject,safeRequestError} from '@/lib/http'
import {validGuestClaimProof} from '@/lib/guestCheckout'
import {guestReceiptSecret} from '@/lib/commerce/purchaseAccess'
import {rateLimit,requestAddress} from '@/lib/rateLimit'
export async function POST(request:Request){
 try{
  if(!await rateLimit('guest-claim-confirm:'+requestAddress(request),20,60))return NextResponse.json({error:'Please wait before trying again'},{status:429})
  const body=await readJsonObject(request,3000),jar=await cookies(),proof=typeof body.proof==='string'?body.proof:jar.get('bt_guest_claim')?.value
  const {data:{user}}=await (await createClient()).auth.getUser()
  if(!user?.email){
   const response=NextResponse.json({error:'Sign in to the account that requested this confirmation.',login:true},{status:401})
   if(typeof proof==='string'&&proof.length<=2000)response.cookies.set('bt_guest_claim',proof,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:900})
   return response
  }
  if(!validGuestClaimProof(proof,user.id,user.email,guestReceiptSecret()))return NextResponse.json({error:'This confirmation is expired or belongs to another account. Request a new confirmation from your library.'},{status:403})
  const {data,error}=await createAdminClient().rpc('claim_guest_purchases',{p_actor:user.id,p_verified_email:user.email.toLowerCase()})
  if(error)return NextResponse.json({error:'Complete your profile and try again. Your existing licenses have not been changed.'},{status:503})
  const response=NextResponse.json({claimed:data||0,url:'/library'},{headers:{'Cache-Control':'private, no-store'}});response.cookies.delete('bt_guest_claim');return response
 }catch(error){const e=safeRequestError(error,'Purchases could not be added');return NextResponse.json({error:e.message},{status:e.status})}
}
