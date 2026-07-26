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
      const payoutRatio = Number(metadata.conversion?.payout_ratio) || 1

      // Cross-check the captured amount against the expected order total so a
      // tampered/underpaid transaction can't fulfill at face value.
      const expectedMinor = Math.round(
        (Number(metadata.conversion?.original_usd_total) || 0) * conversionRate * 100
      )
      const capturedMinor = Number(data.amount) || 0
      if (expectedMinor > 0 && capturedMinor + 1 < expectedMinor) {
        console.error('Paystack webhook: captured amount below expected', { orderId, capturedMinor, expectedMinor })
        return NextResponse.json({ status: 'amount_mismatch' }, { status: 400 })
      }

      // Use the shared fulfillment function — idempotent, safe if verify already ran
      const result = await fulfillOrder({
        orderId,
        cartItems,
        reference: data.reference,
        buyerEmail: data?.customer?.email,
        conversionRate,
        payoutRatio,
        promoCodeId: metadata.promo_code_id || null,
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
        // Store tier uppercase (canonical) so the trending view's PRO/STARTER
        // comparison and platform-fee logic classify it correctly.
        await supabaseAdmin
          .from('producer_settings')
          .update({ subscription_tier: String(metadata.tier).toUpperCase() })
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
        const { error } = await supabaseAdmin
          .from('payouts')
          .update({ status: 'SUCCESS', updated_at: new Date().toISOString() })
          .eq('paystack_transfer_code', transferCode)
        if (error) console.error('transfer.success payout update failed:', error)
      }
      return NextResponse.json({ received: true })
    }

    // Transfer failed — update payout record, restore balance, notify producer.
    // Guarded against double-restore: the balance is only restored when a
    // still-PROCESSING payout row is transitioned to FAILED by this update.
    if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const transferCode = event.data?.transfer_code
      if (transferCode) {
        const { data: payout, error: updateError } = await supabaseAdmin
          .from('payouts')
          .update({ status: 'FAILED', updated_at: new Date().toISOString() })
          .eq('paystack_transfer_code', transferCode)
          .eq('status', 'PROCESSING')
          .select('producer_id, amount')
          .maybeSingle()

        if (updateError) console.error('transfer.failed payout update failed:', updateError)

        // Restore the balance atomically (only if we just flipped it to FAILED)
        if (payout?.producer_id) {
          const { error: restoreError } = await supabaseAdmin.rpc('restore_available_balance', {
            p_producer_id: payout.producer_id,
            p_amount: payout.amount,
          })
          if (restoreError) console.error('Balance restore failed for', payout.producer_id, restoreError)

          await supabaseAdmin.from('notifications').insert({
            user_id: payout.producer_id,
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
