import 'server-only'
import {cookies} from 'next/headers'
import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {UUID_RE} from '@/lib/security'
import {guestCookieName,validGuestReceipt} from '@/lib/guestCheckout'
export async function purchaseAccess(orderId:string){
 if(!UUID_RE.test(orderId))return null
 const db=await createClient(),{data:{user}}=await db.auth.getUser(),jar=await cookies(),token=jar.get(guestCookieName(orderId))?.value
 if(!user&&!token)return null
 const admin=createAdminClient(),{data:order,error}=await admin.from('orders').select('id,buyer_id,status,total_amount,gateway_reference').eq('id',orderId).maybeSingle()
 if(error)throw error
 if(!order)return null
 if(user&&order.buyer_id===user.id)return {order,guest:false,userId:user.id}
 if(order.buyer_id!==null||!token)return null
 const {data:guest,error:guestError}=await admin.from('guest_checkouts').select('receipt_hash,receipt_expires_at,claimed_by').eq('order_id',orderId).maybeSingle()
 if(guestError)throw guestError
 return guest&&validGuestReceipt(token,guest)?{order,guest:true,userId:null}:null
}
export function guestReceiptSecret(){const secret=process.env.GUEST_RECEIPT_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY!;if(!secret||secret.length<32)throw new Error('Guest receipt protection is not configured');return secret}
