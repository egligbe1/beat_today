import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getExchangeRates } from '@/lib/utils/rates'
import { LICENSE_DEFAULTS } from '@/lib/utils/licenseGenerator'
import { fulfillOrder } from '@/lib/utils/fulfillOrder'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request: Request) {
  let orderId: string | undefined
  const admin = createAdminClient()
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!await rateLimit(`checkout:${user.id}`, 10, 60)) return NextResponse.json({ error: 'Please wait before retrying checkout' }, { status: 429 })
    const { items, promo_code, offer_id } = await request.json()
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) return NextResponse.json({ error: 'Choose between 1 and 20 beats' }, { status: 400 })
    const rate = (await getExchangeRates()).GHS
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Exchange rate unavailable')
    const reference = `BT-${randomUUID()}`
    const defaults = { mp3: LICENSE_DEFAULTS.basic, wav: LICENSE_DEFAULTS.premium, trackout: LICENSE_DEFAULTS.unlimited, exclusive: LICENSE_DEFAULTS.exclusive }
    const { data: checkout, error } = await admin.rpc('prepare_checkout', {
      p_buyer: user.id, p_items: items.map((i: any) => ({ beat_id: i.beat_id, license_type: i.license_type })),
      p_reference: reference, p_rate: rate, p_defaults: defaults,
      p_promo: promo_code || null, p_offer: offer_id || null,
    })
    if (error) throw error
    orderId = checkout.order_id
    if (checkout.expected_minor === 0) {
      await fulfillOrder({ orderId: orderId!, reference, capturedMinor: 0, currency: 'GHS' })
      return NextResponse.json({ url: `/checkout/success?order_id=${orderId}` })
    }
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, amount: checkout.expected_minor, currency: 'GHS', email: user.email,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/verify?reference=${reference}`,
        metadata: { order_id: orderId, buyer_id: user.id } }), signal: AbortSignal.timeout(20000),
    })
    const result = await response.json()
    if (!response.ok || !result.status || !result.data?.authorization_url) throw new Error('Payment initialization failed')
    return NextResponse.json({ url: result.data.authorization_url })
  } catch (error) {
    // Timeouts are ambiguous. Preserve pending orders for late verified charges.
    console.error('Checkout initialization failed', { orderId, error })
    return NextResponse.json({ error: 'Unable to start checkout. Please review availability and try again.' }, { status: 400 })
  }
}
