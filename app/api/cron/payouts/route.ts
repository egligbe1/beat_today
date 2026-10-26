import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyQStashSignature } from '@/lib/qstash'

async function paystack(path: string, payload?: any) {
  const response = await fetch(`https://api.paystack.co/${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  })
  return { response, result: await response.json() }
}
export async function POST(request: Request) {
  if (!await verifyQStashSignature(request.clone())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const results: any[] = []
  try {
    const { error: clearanceError } = await admin.rpc('process_mature_funds')
    if (clearanceError) throw clearanceError
    // Reconcile durable attempts first. Timeouts are never treated as failures.
    const { data: attempts, error: attemptError } = await admin.from('payouts').select('*').eq('status','PROCESSING').order('updated_at').limit(5)
    if (attemptError) throw attemptError
    for (const attempt of attempts || []) {
      try {
        const { result } = await paystack(`transfer/verify/${encodeURIComponent(attempt.reference)}`)
        if (result.status && result.data) {
          const { error } = await admin.rpc('finish_payout',{p_reference:attempt.reference,p_status:result.data.status,p_code:result.data.transfer_code || null})
          if (error) throw error
        } else if (attempt.transfer_payload) {
          // A stable reference makes retries safe even if an earlier response was lost.
          const retry = await paystack('transfer', attempt.transfer_payload)
          if (retry.result.status) {
            const { error } = await admin.rpc('finish_payout',{p_reference:attempt.reference,p_status:retry.result.data.status,p_code:retry.result.data.transfer_code || null})
            if (error) throw error
          } else console.warn('Payout still requires reconciliation', attempt.reference)
        }
      } catch (error) { console.error('Payout remains reserved for reconciliation', { reference: attempt.reference, error }) }
      finally { await admin.from('payouts').update({ updated_at: new Date().toISOString() }).eq('id',attempt.id) }
    }
    if (new URL(request.url).searchParams.get('reconcile_only') === '1') return NextResponse.json({ reconciled: attempts?.length || 0 })
    const { data: wallets, error } = await admin.rpc('eligible_payout_wallets')
    if (error) throw error
    for (const wallet of wallets || []) {
      const bd = wallet.bank_details || {}
      const mobile = bd.default_payout === 'mobile_money'
      const details = mobile ? bd.mobile_money : (bd.bank || bd)
      const recipient = mobile ? wallet.mobile_money_recipient_code : wallet.recipient_code
      // This merchant collects/settles in GHS. Other countries need a separately
      // configured payout rail; currency conversion alone does not enable it.
      if (!recipient || details?.country !== 'Ghana') continue
      const payload = { source:'balance', amount:Math.round(Number(wallet.available_balance)*100),
        currency:'GHS', recipient, reason:'BeatToday Earnings', reference:`bt-payout-${randomUUID()}` }
      const { data: attemptId, error: reserveError } = await admin.rpc('begin_payout',{
        p_producer:wallet.producer_id,p_amount:wallet.available_balance,p_payload:payload,
      })
      if (reserveError) { console.error('Payout reservation failed',reserveError); continue }
      if (!attemptId) continue
      try {
        const { result } = await paystack('transfer',payload)
        if (result.status) {
          const { error: finishError } = await admin.rpc('finish_payout',{
            p_reference:payload.reference,p_status:result.data.status,p_code:result.data.transfer_code || null,
          })
          if (finishError) throw finishError
        } else console.warn('Transfer initiation needs reconciliation',payload.reference)
        results.push({ reference: payload.reference, pending: true })
      } catch (error) { console.error('Transfer outcome unknown; preserved for reconciliation',{ reference:payload.reference,error }) }
    }
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Payout cycle failed',error)
    return NextResponse.json({ error:'Payout cycle requires review' },{status:500})
  }
}
