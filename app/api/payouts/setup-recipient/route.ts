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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Unauthorized', { status: 401 })

    const body = await req.json()
    const { method = 'bank', country = 'Ghana' } = body

    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) throw new Error('Paystack secret key not configured.')

    const currency = PAYSTACK_CURRENCY[country]
    if (!currency) {
      // Non-Paystack country — save details for manual review, no recipient code
      await upsertWallet(user.id, null, null, supabase)
      return NextResponse.json({ success: true, recipient_code: null, manualReview: true })
    }

    let recipient_code: string | null = null
    let recipientField: 'recipient_code' | 'mobile_money_recipient_code' = 'recipient_code'

    if (method === 'mobile_money') {
      const { mobile_number, mobile_network, account_name } = body

      if (!mobile_number || !mobile_network) {
        throw new Error('Mobile number and network are required.')
      }

      // Kenya uses 'mpesa' type; others use 'mobile_money'
      const recipientType = country === 'Kenya' ? 'mpesa' : 'mobile_money'

      const res = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
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
      if (!data.status) throw new Error(data.message || 'Failed to create mobile money recipient.')
      recipient_code = data.data.recipient_code
      recipientField = 'mobile_money_recipient_code'

    } else {
      // Bank account
      const { account_number, bank_code, account_name, bank_name } = body

      if (!account_number || !bank_code) throw new Error('Account number and bank code are required.')

      const recipientType = country === 'Nigeria' ? 'nuban'
        : country === 'South Africa' ? 'basa'
        : 'ghipss' // Ghana and others

      const res = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
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
      if (!data.status) throw new Error(data.message || 'Failed to create bank recipient.')
      recipient_code = data.data.recipient_code
      recipientField = 'recipient_code'
    }

    // Save recipient code to wallet
    const { data: existingWallet } = await supabaseAdmin
      .from('wallets')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const updatePayload = { [recipientField]: recipient_code }

    if (existingWallet?.id) {
      await supabaseAdmin.from('wallets').update(updatePayload).eq('user_id', user.id)
    } else {
      await supabaseAdmin.from('wallets').insert({ user_id: user.id, ...updatePayload })
    }

    return NextResponse.json({ success: true, recipient_code })
  } catch (err: any) {
    console.error('Recipient setup failed:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

async function upsertWallet(userId: string, recipientCode: string | null, mobileMmCode: string | null, supabase: any) {
  const { data: existing } = await supabaseAdmin.from('wallets').select('id').eq('user_id', userId).single()
  const payload: any = {}
  if (recipientCode !== null) payload.recipient_code = recipientCode
  if (mobileMmCode !== null) payload.mobile_money_recipient_code = mobileMmCode

  if (existing?.id) {
    await supabaseAdmin.from('wallets').update(payload).eq('user_id', userId)
  } else {
    await supabaseAdmin.from('wallets').insert({ user_id: userId, ...payload })
  }
}
