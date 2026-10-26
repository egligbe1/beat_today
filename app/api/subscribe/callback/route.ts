import { NextResponse } from 'next/server'
import { settleVerifiedPayment, verifyPayment } from '@/lib/payments'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = new URL('/dashboard/subscription', process.env.NEXT_PUBLIC_SITE_URL || url.origin)
  try {
    const tx = await verifyPayment(url.searchParams.get('reference') || url.searchParams.get('trxref') || '')
    if (tx.metadata?.type !== 'subscription') throw new Error('Not a subscription payment')
    await settleVerifiedPayment(tx)
    target.searchParams.set('subscription','success')
  } catch (error) {
    console.error('Subscription activation failed', error)
    target.searchParams.set('error','payment_verification')
  }
  return NextResponse.redirect(target)
}
