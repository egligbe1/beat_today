import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfillOrder } from '@/lib/utils/fulfillOrder'
export async function settleVerifiedPayment(transaction: any) {
  if (transaction.status !== 'success' || !Number.isSafeInteger(transaction.amount) || transaction.amount < 0) throw new Error('Payment not successful')
  try {
  if (transaction.metadata?.type === 'subscription') {
    const { error } = await createAdminClient().rpc('activate_subscription', {
      p_reference: transaction.reference, p_amount: transaction.amount,
      p_currency: transaction.currency, p_paid_at: transaction.paid_at,
    })
    if (error) throw error
    return null
  }
  const orderId = transaction.metadata?.order_id
  if (!orderId) throw new Error('Order reference missing')
  return await fulfillOrder({ orderId, reference: transaction.reference, capturedMinor: transaction.amount, currency: transaction.currency })
  } catch (error) {
    const { error: saved } = await createAdminClient().from('payment_reconciliations').upsert({
      reference: transaction.reference, kind: transaction.metadata?.type === 'subscription' ? 'subscription' : 'order',
      reason: 'Verified charge could not settle; compare provider payment with the saved checkout', observed_at: new Date().toISOString(),
    })
    console.error('Verified payment requires reconciliation', { reference: transaction.reference, error, saved })
    throw error
  }
}
export async function verifyPayment(reference: string) {
  if (!/^[a-zA-Z0-9_-]{6,100}$/.test(reference)) throw new Error('Invalid payment reference')
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(20000),
  })
  const result = await res.json()
  if (!res.ok || !result.status || result.data?.reference !== reference) throw new Error('Verification failed')
  return result.data
}
