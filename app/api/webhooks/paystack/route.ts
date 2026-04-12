import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { fulfillOrder } from '@/lib/utils/fulfillOrder'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const paystackSecret = process.env.PAYSTACK_SECRET_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    // 1. Verify Paystack Signature
    if (!signature || !paystackSecret) {
        console.warn("Webhook Error: Missing signature or secret key")
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hash = crypto.createHmac('sha512', paystackSecret).update(rawBody).digest('hex')
    const signatureBuffer = Buffer.from(signature, 'utf8')
    const hashBuffer = Buffer.from(hash, 'utf8')
    if (signatureBuffer.length !== hashBuffer.length || !crypto.timingSafeEqual(signatureBuffer, hashBuffer)) {
        console.warn('Webhook Error: Invalid Paystack signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody)

    // 2. Process Successful Charge
    if (event.event === 'charge.success') {
      const { data } = event
      const metadata = data.metadata || {}
      const orderId = metadata.order_id
      const cartItems = metadata.cart_items || []

      if (!orderId) {
         console.warn('Paystack webhook missing order_id in metadata')
         return NextResponse.json({ status: 'ignored' })
      }

      const conversionRate = Number(metadata.conversion?.conversion_rate) || 1

      // Use the shared fulfillment function — idempotent, safe if verify already ran
      const result = await fulfillOrder({
        orderId,
        cartItems,
        reference: data.reference,
        buyerEmail: data?.customer?.email,
        conversionRate,
      })

      if (!result) {
        return NextResponse.json({ status: 'already_processed' })
      }

      return NextResponse.json({ status: 'success' })
    }

    // Handle subscription activation
    if (event.event === 'subscription.create') {
      const metadata = event.data?.metadata || {}
      if (metadata.type === 'subscription' && metadata.user_id && metadata.tier) {
        await supabaseAdmin
          .from('producer_settings')
          .update({ subscription_tier: metadata.tier })
          .eq('user_id', metadata.user_id)

        await supabaseAdmin.from('notifications').insert({
          user_id: metadata.user_id,
          type: 'payout_processed',
          title: 'Subscription Activated',
          body: `Your ${metadata.tier} plan is now active. Enjoy your new benefits!`,
          link: '/dashboard/subscription',
        })
      }
    }

    // Transfer completed successfully — update payout record
    if (event.event === 'transfer.success') {
      const transferCode = event.data?.transfer_code
      if (transferCode) {
        await supabaseAdmin
          .from('payouts')
          .update({ status: 'success' })
          .eq('paystack_transfer_code', transferCode)
      }
      return NextResponse.json({ received: true })
    }

    // Transfer failed — update payout record and notify producer
    if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const transferCode = event.data?.transfer_code
      if (transferCode) {
        const { data: payout } = await supabaseAdmin
          .from('payouts')
          .update({ status: 'failed' })
          .eq('paystack_transfer_code', transferCode)
          .select('user_id, amount')
          .single()

        // Restore the balance back to the producer's wallet
        if (payout?.user_id) {
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('available_balance')
            .eq('user_id', payout.user_id)
            .single()

          await supabaseAdmin
            .from('wallets')
            .update({ available_balance: (wallet?.available_balance || 0) + payout.amount })
            .eq('user_id', payout.user_id)

          await supabaseAdmin.from('notifications').insert({
            user_id: payout.user_id,
            type: 'payout_processed',
            title: 'Payout Failed',
            body: 'Your payout could not be processed. Your balance has been restored. Please check your bank details in Settings.',
            link: '/dashboard/wallet',
          })
        }
      }
      return NextResponse.json({ received: true })
    }

    // Default 200 for unhandled events
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("Paystack Webhook Fatal Error:", error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
