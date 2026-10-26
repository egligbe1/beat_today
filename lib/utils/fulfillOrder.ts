import { createAdminClient } from '@/lib/supabase/admin'
import { after } from 'next/server'
import { sendLicenseEmail } from '@/lib/utils/emailService'
import { generateAgreementPdf } from '@/lib/utils/pdfGenerator'

/** Settlement commits money, licenses and delivery jobs together, exactly once. */
export async function fulfillOrder({ orderId, reference, capturedMinor, currency }: {
  orderId: string; reference: string; capturedMinor: number; currency: string
}) {
  const { data, error } = await createAdminClient().rpc('settle_order', {
    p_order: orderId, p_reference: reference, p_amount: capturedMinor, p_currency: currency,
  })
  if (error) throw error
  after(() => deliverLicenses(orderId))
  return data as string
}
export async function deliverLicenses(orderId?: string) {
  const admin = createAdminClient()
  let query = admin.from('delivery_jobs')
    .select('order_item_id, order_items!inner(order_id, agreement_snapshot, orders!inner(buyer_id,status))')
    .is('sent_at', null).eq('order_items.orders.status', 'completed')
    .or(`claimed_at.is.null,claimed_at.lt.${new Date(Date.now() - 10 * 60 * 1000).toISOString()}`).limit(20)
  if (orderId) query = query.eq('order_items.order_id', orderId)
  const { data: jobs, error } = await query
  if (error) throw error
  for (const job of jobs || []) {
    const { data: claimed, error: claimError } = await admin.rpc('claim_delivery_job', { p_item: job.order_item_id })
    if (claimError) throw claimError
    if (!claimed) continue
    try {
      const item = job.order_items as any
      const snapshot = item.agreement_snapshot
      if (!snapshot?.legal_text) throw new Error('Agreement snapshot missing; reconcile this purchase')
      const { data: buyer, error: buyerError } = await admin.auth.admin.getUserById(item.orders.buyer_id)
      if (buyerError || !buyer.user?.email) throw new Error('Buyer email unavailable')
      const pdf = await generateAgreementPdf(snapshot.legal_text)
      const result = await sendLicenseEmail({
        to: buyer.user.email, buyerName: snapshot.buyer_name, trackTitle: snapshot.track_title,
        contractHtml: snapshot.legal_text, idempotencyKey: `license-${job.order_item_id}`,
        attachments: [{ filename: `License_${job.order_item_id}.pdf`, content: pdf }],
      })
      if (!result.success) throw new Error('Email provider rejected delivery')
      const { error: saved } = await admin.from('delivery_jobs').update({ sent_at: new Date().toISOString(), last_error: null }).eq('order_item_id', job.order_item_id)
      if (saved) throw saved
    } catch (error) {
      console.error('License delivery will retry', { item: job.order_item_id, error })
      const { error: saved } = await admin.from('delivery_jobs').update({ claimed_at: null, last_error: 'Delivery failed; check server logs' }).eq('order_item_id', job.order_item_id)
      if (saved) console.error('Could not release delivery job', saved)
    }
  }
}
