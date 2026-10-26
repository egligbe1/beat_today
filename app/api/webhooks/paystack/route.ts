import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { settleVerifiedPayment } from '@/lib/payments'
export async function POST(request: Request) {
  try {
    const body = await request.text()
    const secret = process.env.PAYSTACK_SECRET_KEY
    const signature = request.headers.get('x-paystack-signature') || ''
    if (!secret || !/^[a-f0-9]{128}$/i.test(signature)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const expected = crypto.createHmac('sha512', secret).update(body).digest()
    if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const event = JSON.parse(body)
    if (event.event === 'charge.success') await settleVerifiedPayment({ ...event.data, status: 'success' })
    if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event)) {
      const { error } = await createAdminClient().rpc('finish_payout', {
        p_reference: event.data.reference, p_status: event.event.split('.')[1], p_code: event.data.transfer_code || null,
      })
      if (error) throw error
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Payment webhook requires retry/reconciliation', error)
    return NextResponse.json({ error: 'Processing failed; retry required' }, { status: 500 })
  }
}
