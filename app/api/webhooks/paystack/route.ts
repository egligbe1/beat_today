import {paymentCaseEvent} from '@/lib/paymentCases'
import { NextResponse } from 'next/server'
import {validPaystackSignature} from '@/lib/paymentSignature'
import {readRequestText,RequestError} from '@/lib/http'
import { createAdminClient } from '@/lib/supabase/admin'
import { settleVerifiedPayment } from '@/lib/payments'
export async function POST(request: Request) {
  try {
    const secret=process.env.PAYSTACK_SECRET_KEY
    const signature=request.headers.get('x-paystack-signature')
    if(!secret||!signature||!/^[a-f0-9]{128}$/i.test(signature))return NextResponse.json({error:'Unauthorized'},{status:401})
    const body=await readRequestText(request,256000)
    if(!validPaystackSignature(body,signature,secret))return NextResponse.json({error:'Unauthorized'},{status:401})
    const event = JSON.parse(body)
    const paymentCase=paymentCaseEvent(event,body)
    if(paymentCase){
      const {error}=await createAdminClient().rpc('record_payment_case',paymentCase)
      if(error)throw error
    }
    if (event.event === 'charge.success') await settleVerifiedPayment({ ...event.data, status: 'success' })
    if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event.event)) {
      const { error } = await createAdminClient().rpc('finish_payout', {
        p_reference: event.data.reference, p_status: event.event.split('.')[1], p_code: event.data.transfer_code || null,
      })
      if (error) throw error
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    if(error instanceof RequestError)return NextResponse.json({error:error.message},{status:error.status})
    console.error('Payment webhook requires retry/reconciliation', error)
    return NextResponse.json({ error: 'Processing failed; retry required' }, { status: 500 })
  }
}
