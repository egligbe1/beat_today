import { NextResponse } from 'next/server'
import { settleVerifiedPayment, verifyPayment } from '@/lib/payments'
export async function GET(request: Request) {
  try {
    const tx = await verifyPayment(new URL(request.url).searchParams.get('reference') || '')
    const orderId = await settleVerifiedPayment(tx)
    return NextResponse.json({ success: true, order_id: orderId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Payment verification requires retry/reconciliation', error)
    return NextResponse.json({ success: false, error: 'Payment is not yet fulfilled. Retry verification or contact support with your payment reference.' }, { status: 422 })
  }
}
