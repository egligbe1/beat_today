import { readJsonObject, RequestError } from '@/lib/http'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getExchangeRates } from '@/lib/utils/rates'
import { LICENSE_DEFAULTS } from '@/lib/utils/licenseGenerator'
import { fulfillOrder } from '@/lib/utils/fulfillOrder'
import {createGuestReceipt,guestDetails,guestCookieName,GUEST_RECEIPT_DAYS} from '@/lib/guestCheckout'
import {guestReceiptSecret} from '@/lib/commerce/purchaseAccess'
import { rateLimit,requestAddress } from '@/lib/rateLimit'

export async function POST(request: Request) {
  let orderId: string | undefined
  const admin = createAdminClient()
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!await rateLimit(user?`checkout:${user.id}`:`guest-checkout:${requestAddress(request)}`,user?10:5,user?60:900)) return NextResponse.json({ error: 'Please wait before retrying checkout' }, { status: 429 })
    const { items, promo_code, offer_id,guest:guestInput } = await readJsonObject(request,20000)
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) return NextResponse.json({ error: 'Choose between 1 and 20 beats' }, { status: 400 })
    const guest=user?null:guestDetails(guestInput)
    if(guest&&offer_id)return NextResponse.json({error:'Sign in to purchase an accepted offer'},{status:401})
    if(guest&&(!await rateLimit('guest-email:'+guest.email,3,900)||!await rateLimit('guest-checkout-global',60,60)))return NextResponse.json({error:'Please wait before starting another checkout'},{status:429})
    const receipt=guest?createGuestReceipt(guestReceiptSecret()):null
    const email=user?.email||guest?.email
    if(!email)throw new RequestError('A delivery email is required')
    const rate = (await getExchangeRates({allowFallback:false})).GHS
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Exchange rate unavailable')
    const reference = `BT-${randomUUID()}`
    const defaults = { mp3: LICENSE_DEFAULTS.basic, wav: LICENSE_DEFAULTS.premium, trackout: LICENSE_DEFAULTS.unlimited, exclusive: LICENSE_DEFAULTS.exclusive }
    const common={p_items:items.map((i:any)=>({beat_id:i.beat_id,license_type:i.license_type})),p_reference:reference,p_rate:rate,p_defaults:defaults,p_promo:promo_code||null}
    const {data:checkout,error}=guest&&receipt
      ?await admin.rpc('prepare_guest_checkout',{...common,p_email:guest.email,p_name:guest.name,p_receipt_hash:receipt.hash,p_receipt_ciphertext:receipt.ciphertext})
      :await admin.rpc('prepare_checkout',{...common,p_buyer:user!.id,p_offer:offer_id||null})
    if (error) throw error
    orderId = checkout.order_id
    const respond=(url:string)=>{
      const response=NextResponse.json({url},{headers:{'Cache-Control':'private, no-store'}})
      if(receipt)response.cookies.set(guestCookieName(orderId!),receipt.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:GUEST_RECEIPT_DAYS*86400})
      return response
    }
    if (checkout.expected_minor === 0) {
      await fulfillOrder({ orderId: orderId!, reference, capturedMinor: 0, currency: 'GHS' })
      return respond(`/checkout/success?order_id=${orderId}`)
    }
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, amount: checkout.expected_minor, currency: 'GHS', email,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/verify?reference=${reference}`,
        metadata: { order_id: orderId, buyer_id: user?.id||null } }), signal: AbortSignal.timeout(20000),
    })
    const result = await response.json()
    if (!response.ok || !result.status || !result.data?.authorization_url) throw new Error('Payment initialization failed')
    return respond(result.data.authorization_url)
  } catch (error) {
    if(error instanceof RequestError)return NextResponse.json({error:error.message},{status:error.status})
    // Timeouts are ambiguous. Preserve pending orders for late verified charges.
    console.error('Checkout initialization failed', { orderId, code:error&&typeof error==='object'&&'code' in error?error.code:'checkout_error' })
    return NextResponse.json({ error: 'Unable to start checkout. Please review availability and try again.' }, { status: 400 })
  }
}
