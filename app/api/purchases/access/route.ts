import {NextResponse} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {readJsonObject,safeRequestError} from '@/lib/http'
import {UUID_RE} from '@/lib/security'
import {rateLimit,requestAddress} from '@/lib/rateLimit'
import {guestCookieName,validGuestReceipt,GUEST_RECEIPT_DAYS} from '@/lib/guestCheckout'
export async function POST(request:Request){
 try{
  if(!await rateLimit('guest-access:'+requestAddress(request),20,60))return NextResponse.json({error:'Please wait before trying again'},{status:429})
  const {order_id,token}=await readJsonObject(request,3000)
  if(typeof order_id!=='string'||!UUID_RE.test(order_id))return NextResponse.json({error:'Invalid purchase link'},{status:400})
  const {data:guest,error}=await createAdminClient().from('guest_checkouts').select('receipt_hash,receipt_expires_at,claimed_by,orders!inner(buyer_id,status)').eq('order_id',order_id).maybeSingle()
  if(error)throw error
  if(!guest||(guest.orders as any)?.buyer_id!==null||!validGuestReceipt(token,guest))return NextResponse.json({error:'This purchase link is unavailable or expired. Recover it by email or sign in to your library.'},{status:403})
  const response=NextResponse.json({url:'/checkout/success?order_id='+order_id},{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}})
  response.cookies.set(guestCookieName(order_id),token as string,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:Math.max(0,Math.min(GUEST_RECEIPT_DAYS*86400,Math.floor((Date.parse(guest.receipt_expires_at)-Date.now())/1000)))})
  return response
 }catch(error){const e=safeRequestError(error,'Your purchase link could not be opened');return NextResponse.json({error:e.message},{status:e.status})}
}
