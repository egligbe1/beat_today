import { readJsonObject, RequestError, safeRequestError } from '@/lib/http'
import { payoutAccount, payoutBank, payoutName } from '@/lib/payoutValidation'
import { rateLimit } from '@/lib/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAYSTACK_CURRENCY: Record<string, string> = {
  Nigeria: 'NGN',
  Ghana: 'GHS',
  Kenya: 'KES',
  'South Africa': 'ZAR',
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const body = await readJsonObject(req,8000)
    const { method = 'bank', country = 'Ghana' } = body
    if(typeof method!=='string'||!['bank','mobile_money'].includes(method)||typeof country!=='string'||country.length>80)throw new RequestError('Invalid payout method or country')
    const { data: profile } = await supabaseAdmin.from('users_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'producer') return NextResponse.json({ error: 'Producer account required' }, { status: 403 })

    if(!await rateLimit('setup-recipient:'+user.id,5,60))return NextResponse.json({error:'Please wait before changing your payout details'},{status:429})
    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) throw new Error('Paystack secret key not configured.')

    const currency = PAYSTACK_CURRENCY[country as string]
    if (!currency || country !== 'Ghana') {
      // Non-Paystack country — save details for manual review, no recipient code
      await upsertWallet(user.id)
      return NextResponse.json({ success: true, recipient_code: null, manualReview: true })
    }

    let recipient_code: string | null = null
    let recipientField: 'recipient_code' | 'mobile_money_recipient_code' = 'recipient_code'

    if (method === 'mobile_money') {
      const mobile_number=payoutAccount(body.mobile_number),mobile_network=payoutBank(body.mobile_network),account_name=payoutName(body.account_name)

      if (!mobile_number || !mobile_network) {
        throw new Error('Mobile number and network are required.')
      }

      const recipientType = 'mobile_money'

      const res = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: recipientType,
          name: account_name,
          account_number: mobile_number,
          bank_code: mobile_network, // Paystack uses bank_code for network code
          currency,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.status || typeof data.data?.recipient_code!=='string') throw new Error('Recipient setup unavailable')
      recipient_code = data.data.recipient_code
      recipientField = 'mobile_money_recipient_code'

    } else {
      // Bank account
      const account_number=payoutAccount(body.account_number),bank_code=payoutBank(body.bank_code),account_name=payoutName(body.account_name)

      if (!account_number || !bank_code) throw new Error('Account number and bank code are required.')

      const recipientType = 'ghipss'

      const res = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: recipientType,
          name: account_name,
          account_number,
          bank_code,
          currency,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.status || typeof data.data?.recipient_code!=='string') throw new Error('Recipient setup unavailable')
      recipient_code = data.data.recipient_code
      recipientField = 'recipient_code'
    }

    // Save recipient code to wallet (wallets are keyed on producer_id).
    // Upsert is atomic and avoids the check-then-write race.
    const { error: saveError } = await supabaseAdmin
      .from('wallets')
      .upsert(
        { producer_id: user.id, [recipientField]: recipient_code },
        { onConflict: 'producer_id' }
      )

    if (saveError) throw saveError

    return NextResponse.json({ success: true, recipient_code })
  } catch (err: unknown) {
    const e=safeRequestError(err,'Payout details could not be saved. Please try again.')
    return NextResponse.json({ success: false, error: e.message }, { status: e.status, headers:{'Cache-Control':'private, no-store'} })
  }
}

async function upsertWallet(userId:string) {
 const {error}=await supabaseAdmin.from('wallets').upsert({producer_id:userId},{onConflict:'producer_id'})
 if(error)throw error
}
