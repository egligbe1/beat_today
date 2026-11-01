import {NextResponse,after} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {guestDetails,createGuestReceipt,decryptGuestReceipt,guestReceiptLink} from '@/lib/guestCheckout'
import {guestReceiptSecret} from '@/lib/commerce/purchaseAccess'
import {readJsonObject,safeRequestError} from '@/lib/http'
import {rateLimit,requestAddress} from '@/lib/rateLimit'
import {sendGuestRecoveryEmail} from '@/lib/utils/emailService'
export async function POST(request:Request){
 try{
  if(!await rateLimit('guest-recover-ip:'+requestAddress(request),3,900))return NextResponse.json({error:'Please wait before requesting another email'},{status:429})
  const body=await readJsonObject(request,2000),email=guestDetails({name:'Purchase recovery',email:body.email,accepted_terms:true}).email
  if(!await rateLimit('guest-recover-email:'+email,3,900)||!await rateLimit('guest-recover-global',30,900))return NextResponse.json({success:true,message:'If completed guest purchases match this email, we will send private purchase links.'})
  const reference=typeof body.reference==='string'&&/^[A-Za-z0-9_-]{6,100}$/.test(body.reference)?body.reference:null
  after(async()=>{
   try{
    const admin=createAdminClient()
    let query=admin.from('guest_checkouts').select('order_id,orders!inner(status,gateway_reference)').eq('email',email).is('claimed_by',null).eq('orders.status','completed').order('created_at',{ascending:false}).limit(50)
    if(reference)query=query.eq('orders.gateway_reference',reference)
    const {data:guests,error}=await query;if(error)throw error
    const links:{reference:string;url:string}[]=[]
    const prepared=await Promise.all((guests||[]).map(async guest=>{
     const fresh=createGuestReceipt(guestReceiptSecret()),{data:current,error:refreshError}=await admin.rpc('refresh_guest_receipt',{p_order:guest.order_id,p_hash:fresh.hash,p_ciphertext:fresh.ciphertext})
     if(refreshError)throw refreshError
     return current?{reference:(guest.orders as any).gateway_reference,url:guestReceiptLink(process.env.NEXT_PUBLIC_SITE_URL!,guest.order_id,decryptGuestReceipt(current.ciphertext,guestReceiptSecret()))}:null
    }))
    for(const item of prepared)if(item)links.push(item)
    if(links.length)await sendGuestRecoveryEmail(email,links)
   }catch{console.error('Guest purchase recovery email needs retry')}
  })
  return NextResponse.json({success:true,message:'If completed guest purchases match this email, we will send private purchase links.'},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){const e=safeRequestError(error,'Purchase recovery is temporarily unavailable');return NextResponse.json({error:e.message},{status:e.status})}
}
