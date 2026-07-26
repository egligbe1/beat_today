import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getExchangeRates } from '@/lib/utils/rates'
import { verifyQStashSignature } from '@/lib/qstash'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const paystackSecret = process.env.PAYSTACK_SECRET_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Wallet balances are stored in GHS (checkout currency)
// Minimum payout: ~GHS 50 (≈ $3-4 USD)
const MIN_PAYOUT_GHS = 50

// Maps producer's bank country to the local currency for the Paystack transfer
const COUNTRY_CURRENCY: Record<string, string> = {
  Ghana: 'GHS',
  Nigeria: 'NGN',
  Kenya: 'KES',
  'South Africa': 'ZAR',
}

export async function POST(req: Request) {
  const isValid = await verifyQStashSignature(req.clone())
  if (!isValid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Move all matured pending balances → available
    await supabaseAdmin.rpc('process_mature_funds')

    // 2. Find all wallets with enough available balance and at least one recipient code
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('*, users_profiles(id, email)')
      .gte('available_balance', MIN_PAYOUT_GHS)
      .not('bank_details', 'is', null)
      .or('recipient_code.not.is.null,mobile_money_recipient_code.not.is.null')

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({ message: 'No eligible payouts found.' })
    }

    // Fetch rates once — balances are in GHS, need to convert to producer's local currency
    const rates = await getExchangeRates()
    const ghsRate = rates['GHS'] || 14.5

    const payoutResults = []

    for (const wallet of wallets) {
      try {
        const bankDetails = wallet.bank_details || {}
        const defaultMethod = bankDetails.default_payout || 'bank'

        // Resolve the active payout details and recipient code based on default method
        const activeDetails = defaultMethod === 'mobile_money'
          ? (bankDetails.mobile_money || {})
          : (bankDetails.bank || bankDetails) // backwards-compat

        const recipientCode = defaultMethod === 'mobile_money'
          ? wallet.mobile_money_recipient_code
          : wallet.recipient_code

        const country = activeDetails.country || bankDetails.country || 'Ghana'
        const currency = COUNTRY_CURRENCY[country] || 'GHS'

        if (!recipientCode) {
          payoutResults.push({ producer_id: wallet.producer_id, status: 'skipped', reason: `No recipient code for ${defaultMethod} — producer must complete payout setup` })
          continue
        }

        // Convert GHS balance → producer's local currency
        // GHS producers: 1:1. Others: GHS ÷ GHS_rate × local_rate
        const localRate = rates[currency] || ghsRate
        const localAmount = currency === 'GHS'
          ? Number(wallet.available_balance)
          : Number((Number(wallet.available_balance) / ghsRate * localRate).toFixed(2))

        // Paystack expects amount in smallest unit (pesewas/kobo/cents)
        const paystackAmount = Math.round(localAmount * 100)

        // 3. Deduct balance safely via RPC *before* initializing Paystack transfer
        // deduct_available_balance returns void and RAISEs on insufficient/locked
        // funds, so a null `data` is success — only the error signals failure.
        const { error: deductError } = await supabaseAdmin.rpc('deduct_available_balance', {
           p_producer_id: wallet.producer_id,
           p_amount: wallet.available_balance
        })

        if (deductError) {
           console.warn(`Insufficient or locked funds for producer ${wallet.producer_id}`)
           payoutResults.push({ producer_id: wallet.producer_id, status: 'skipped', reason: 'Insufficient funds during atomic deduction' })
           continue
        }

        const transferPayload = {
          source: 'balance',
          amount: paystackAmount,
          currency,
          recipient: recipientCode,
          reason: 'BeatToday Earnings Payout',
          reference: `BT-PAYOUT-${wallet.producer_id}-${Date.now()}`,
        }

        const res = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transferPayload),
        })

        const data = await res.json()

        if (data.status) {
          const transferCode = data.data?.transfer_code || data.data?.reference

          const { error: payoutInsertError } = await supabaseAdmin.from('payouts').insert({
            producer_id: wallet.producer_id,
            amount: wallet.available_balance,
            currency: 'GHS',
            status: 'PROCESSING',
            reference: transferPayload.reference,
            paystack_transfer_code: transferCode,
          })
          if (payoutInsertError) console.error('Payout record insert failed:', payoutInsertError)

          const { error: ledgerInsertError } = await supabaseAdmin.from('ledger_transactions').insert({
            producer_id: wallet.producer_id,
            amount: -wallet.available_balance,
            type: 'PAYOUT',
            status: 'AVAILABLE',
            description: `Payout to ${bankDetails.bank_name || 'bank'} ${bankDetails.account_number}`,
            reference_id: transferCode,
          })
          if (ledgerInsertError) console.error('Payout ledger insert failed:', ledgerInsertError)

          // Notify producer (Notification uses user_id)
          await supabaseAdmin.from('notifications').insert({
            user_id: wallet.producer_id,
            type: 'payout_processed',
            title: 'Payout Initiated',
            body: `GH₵${Number(wallet.available_balance).toFixed(2)} is on its way to your bank account.`,
            link: '/dashboard/wallet',
          })

          payoutResults.push({ producer_id: wallet.producer_id, status: 'success', transfer_code: transferCode, amount_ghs: wallet.available_balance })
        } else {
          console.error(`Payout failed for producer ${wallet.producer_id}:`, data.message)
          
          // CRITICAL: Restore balance since external transfer failed inline
          await supabaseAdmin.rpc('restore_available_balance', {
             p_producer_id: wallet.producer_id,
             p_amount: wallet.available_balance
          })

          payoutResults.push({ producer_id: wallet.producer_id, status: 'failed', error: data.message })
        }
      } catch (err: any) {
        console.error(`Payout error for producer ${wallet.producer_id}:`, err)
        // If an exception occurs, ensure we don't hold the balance hostage
        payoutResults.push({ producer_id: wallet.producer_id, status: 'failed', error: err.message })
      }
    }

    return NextResponse.json({
      message: `Processed ${wallets.length} wallet(s).`,
      results: payoutResults,
    })
  } catch (err: any) {
    console.error('Payout cron failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
