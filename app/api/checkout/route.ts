import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { items, promo_code, discount_amount } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const authSupabase = createServerClient()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id

    // 2. Validate item pricing and availability before creating an order
    const beatIds = items.map((i: any) => i.beat_id)
    const { data: beatsData, error: beatsError } = await supabaseAdmin
      .from('beats')
      .select('id, producer_id, status, is_exclusive_sold, price_mp3, price_wav, price_trackout, price_exclusive')
      .in('id', beatIds)

    if (beatsError || !beatsData) throw beatsError || new Error('Failed to fetch beat pricing')

    const priceFieldByLicense: Record<string, keyof typeof beatsData[0]> = {
      mp3: 'price_mp3',
      wav: 'price_wav',
      trackout: 'price_trackout',
      exclusive: 'price_exclusive'
    }

    const validatedOrderItems = items.map((item: any) => {
      const beat = beatsData.find((beat) => beat.id === item.beat_id)
      if (!beat) throw new Error(`Beat ${item.beat_id} could not be found`)
      if (beat.status !== 'active') throw new Error(`Beat ${item.beat_id} is no longer available`)
      if (item.license_type === 'exclusive' && (beat.is_exclusive_sold || beat.status === 'sold')) {
        throw new Error(`Exclusive license for beat ${item.beat_id} has already been sold`)
      }

      const priceKey = priceFieldByLicense[item.license_type]
      const dbPrice = beat[priceKey]
      if (typeof dbPrice !== 'number' || dbPrice <= 0) {
        throw new Error(`Invalid license price for ${item.license_type} on beat ${item.beat_id}`)
      }

      return {
        beat_id: item.beat_id,
        producer_id: beat.producer_id,
        license_type: item.license_type,
        price: dbPrice,
        title: item.title
      }
    })

    const subtotal = validatedOrderItems.reduce((sum: number, item: any) => sum + Number(item.price), 0)
    const appliedDiscount = Math.min(Number(discount_amount) || 0, subtotal)
    const totalAmount = Math.max(0, subtotal - appliedDiscount)
    const tx_ref = `BT-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: totalAmount,
        status: 'pending',
        gateway: 'paystack',
        gateway_reference: tx_ref,
        ...(promo_code ? { promo_code_id: promo_code, discount_amount: appliedDiscount } : {})
      })
      .select()
      .single()

    if (orderError) throw orderError

    const insertItems = validatedOrderItems.map((item: any) => ({
      order_id: order.id,
      beat_id: item.beat_id,
      producer_id: item.producer_id,
      license_type: item.license_type,
      price: item.price
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(insertItems)

    if (itemsError) throw itemsError

    // 5. Convert USD total to GHS for Paystack (merchant account currency is GHS)
    const { getExchangeRates } = await import('@/lib/utils/rates')
    const rates = await getExchangeRates()

    const checkoutCurrency = 'GHS'
    const rate = rates['GHS'] || 14.5
    const convertedAmount = Number((totalAmount * rate).toFixed(2))

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const paystackPayload = {
      reference: tx_ref,
      amount: Math.round(convertedAmount * 100), // Paystack uses smallest currency unit (kobo/cents)
      currency: checkoutCurrency,
      email: user.email,
      callback_url: `${siteUrl}/checkout/verify?reference=${tx_ref}`, // We let the frontend handle the visual redirect
      metadata: {
        order_id: order.id,
        buyer_id: userId,
        cart_items: validatedOrderItems.map((item: any) => ({
           beat_id: item.beat_id,
           producer_id: item.producer_id,
           price_usd: item.price,
           title: item.title,
           license_type: item.license_type
        })),
        conversion: {
            checkout_currency: 'GHS',
            conversion_rate: rate,
            original_usd_subtotal: subtotal,
            discount_usd: appliedDiscount,
            original_usd_total: totalAmount
        }
      }
    }

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackPayload)
    })

    const paystackData = await paystackResponse.json()

    if (paystackData.status) {
      return NextResponse.json({ url: paystackData.data.authorization_url })
    } else {
      console.error('Paystack initialization failed:', paystackData)
      throw new Error(paystackData.message || 'Failed to initialize Paystack payment')
    }

  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
