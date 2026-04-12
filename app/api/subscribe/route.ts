import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExchangeRates } from '@/lib/utils/rates'

// Annual subscription prices in USD — converted to GHS at checkout
const TIER_PRICES_USD: Record<string, number> = {
  STARTER: 9.99,
  PRO: 59.99,
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await req.json()
  if (!['STARTER', 'PRO'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('email, display_name')
    .eq('id', user.id)
    .single()

  const email = profile?.email || user.email
  if (!email) return NextResponse.json({ error: 'No email found' }, { status: 400 })

  // Convert USD price → GHS (Paystack only supports GHS for this merchant)
  let ghsRate = 14.5
  try {
    const rates = await getExchangeRates()
    ghsRate = rates['GHS'] || 14.5
  } catch { /* use fallback */ }

  const usdPrice = TIER_PRICES_USD[tier]
  const ghsAmount = Math.round(usdPrice * ghsRate * 100) // Paystack amount in pesewas

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const callbackUrl = `${siteUrl}/api/subscribe/callback?tier=${tier}&user_id=${user.id}`

  // Initialize a one-time Paystack transaction for the annual fee
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: ghsAmount,
      currency: 'GHS',
      callback_url: callbackUrl,
      metadata: {
        user_id: user.id,
        tier,
        type: 'subscription',
        usd_price: usdPrice,
      },
      channels: ['card', 'mobile_money', 'bank'],
    }),
  })

  const data = await res.json()
  if (!data.status) {
    console.error('Paystack subscription init error:', data)
    return NextResponse.json({ error: data.message || 'Failed to initialize payment' }, { status: 500 })
  }

  return NextResponse.json({ authorization_url: data.data.authorization_url })
}
