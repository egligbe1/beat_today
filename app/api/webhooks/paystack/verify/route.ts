import { NextResponse } from 'next/server'
import { fulfillOrder } from '@/lib/utils/fulfillOrder'

const paystackSecret = process.env.PAYSTACK_SECRET_KEY!

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const reference = searchParams.get('reference')

    if (!reference) {
      return NextResponse.json({ success: false, error: 'Reference is required' }, { status: 400 })
    }

    if (!paystackSecret) {
      return NextResponse.json({ success: false, error: 'Paystack secret key not configured' }, { status: 500 })
    }

    // Verify transaction with Paystack
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!data.status) {
      return NextResponse.json({ success: false, error: data.message || 'Verification failed' }, { status: 400 })
    }

    const transaction = data.data

    if (transaction.status === 'success') {
      const metadata = transaction.metadata || {}
      const orderId = metadata.order_id

      if (!orderId) {
        return NextResponse.json({ success: false, error: 'Order ID not found in transaction metadata' }, { status: 400 })
      }

      const conversionRate = Number(metadata.conversion?.conversion_rate) || 1
      const payoutRatio = Number(metadata.conversion?.payout_ratio) || 1
      const cartItems = metadata.cart_items || []

      // Attempt full order fulfillment.
      // This is idempotent — if the webhook already completed the order,
      // fulfillOrder will return null and no double-processing occurs.
      await fulfillOrder({
        orderId,
        cartItems,
        reference,
        buyerEmail: transaction.customer?.email,
        conversionRate,
        payoutRatio,
        promoCodeId: metadata.promo_code_id || null,
      })

      return NextResponse.json({ success: true, order_id: orderId })
    } else {
      return NextResponse.json({ success: false, error: 'Payment not successful' }, { status: 400 })
    }

  } catch (err: any) {
    console.error('Verification error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}