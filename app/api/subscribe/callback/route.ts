import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/subscribe/callback?tier=STARTER&user_id=xxx&trxref=xxx&reference=xxx
 * Called by Paystack after the payment page. Verifies payment and upgrades the user.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tier = searchParams.get('tier')
  const userId = searchParams.get('user_id')
  const reference = searchParams.get('reference') || searchParams.get('trxref')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!tier || !userId || !reference) {
    return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=missing_params`)
  }

  if (!['STARTER', 'PRO'].includes(tier)) {
    return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=invalid_tier`)
  }

  try {
    // Verify the transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const verifyData = await verifyRes.json()

    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.error('Subscription payment not successful:', verifyData)
      return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=payment_failed`)
    }

    // Confirm metadata matches to prevent spoofing
    const meta = verifyData.data?.metadata || {}
    if (meta.user_id !== userId || meta.tier !== tier || meta.type !== 'subscription') {
      console.error('Metadata mismatch on subscription callback')
      return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=metadata_mismatch`)
    }

    // Upgrade the user's tier in producer_settings
    // subscription_expires_at = 1 year from now
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    const { error: updateError } = await supabaseAdmin
      .from('producer_settings')
      .update({
        subscription_tier: String(tier).toUpperCase(),
        subscription_expires_at: expiresAt.toISOString(),
        subscription_reference: reference,
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to upgrade user tier:', updateError)
      return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=upgrade_failed`)
    }

    // Send a notification to the producer (non-fatal)
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'subscription_upgraded',
        title: `Welcome to ${tier}!`,
        body: `Your account has been upgraded to ${tier}. Enjoy your new features!`,
        link: '/dashboard/subscription',
      })
    } catch (e) {
      console.warn('Non-fatal: Failed to send subscription notification:', e)
    }

    return NextResponse.redirect(`${siteUrl}/dashboard/subscription?subscription=success&tier=${tier}`)
  } catch (err: any) {
    console.error('Subscription callback error:', err)
    return NextResponse.redirect(`${siteUrl}/dashboard/subscription?error=server_error`)
  }
}
