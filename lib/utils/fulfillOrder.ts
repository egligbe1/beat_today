import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Fulfills a completed order: updates status, credits producer wallets,
 * generates licenses, sends emails, and handles exclusive beat logic.
 *
 * This function is idempotent — it uses an atomic status check
 * (`eq('status', 'pending')`) so it's safe to call from both the
 * Paystack webhook and the client-side verify route.
 *
 * @returns The order ID if successfully fulfilled, or null if already processed.
 */
export async function fulfillOrder({
  orderId,
  cartItems,
  reference,
  buyerEmail: externalBuyerEmail,
  conversionRate = 1,
}: {
  orderId: string
  cartItems: Array<{
    beat_id: string
    producer_id: string
    license_type: string
    title?: string
    price_usd?: number
    price?: number
  }>
  reference: string
  buyerEmail?: string
  conversionRate?: number
}) {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Atomically mark order as completed (only if still pending)
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'completed', gateway_reference: reference })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id, buyer_id')
    .single()

  if (updateError || !updatedOrder) {
    console.warn('fulfillOrder: Order already processed or not found', orderId)
    return null // Already completed — safe to skip
  }

  // 2. Get buyer profile and auth details for personalization
  const [{ data: buyerProfile }, { data: authResult }] = await Promise.all([
    supabaseAdmin
      .from('users_profiles')
      .select('display_name, email, handle')
      .eq('id', updatedOrder.buyer_id)
      .single(),
    supabaseAdmin.auth.admin.getUserById(updatedOrder.buyer_id)
  ])

  const buyerEmail = externalBuyerEmail || buyerProfile?.email || authResult.user?.email
  const buyerName = buyerProfile?.display_name || 
                   authResult.user?.user_metadata?.full_name || 
                   authResult.user?.user_metadata?.display_name || 
                   buyerProfile?.handle || 
                   'Valued Customer'

  // 3. Process each cart item
  for (const item of cartItems) {
    try {
      // --- Producer Payout Logic ---
      const { data: pSettings } = await supabaseAdmin
        .from('producer_settings')
        .select('subscription_tier')
        .eq('user_id', item.producer_id)
        .single()

      const tier = String(pSettings?.subscription_tier || 'FREE').toUpperCase()
      let platformCutPercentage = 0.2
      if (tier === 'STARTER') platformCutPercentage = 0.1
      if (tier === 'PRO') platformCutPercentage = 0

      const itemPriceUsd = Number(item.price_usd ?? item.price ?? 0)
      const itemAmountInCheckoutCurrency = itemPriceUsd * conversionRate
      const producerPayout = itemAmountInCheckoutCurrency * (1 - platformCutPercentage)

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id')
        .eq('user_id', item.producer_id)
        .single()

      let walletId = wallet?.id
      if (!walletId) {
        const { data: createdWallet } = await supabaseAdmin
          .from('wallets')
          .insert({ user_id: item.producer_id })
          .select('id')
          .single()
        walletId = createdWallet?.id
      }

      const maturityDate = new Date()
      maturityDate.setHours(maturityDate.getHours() + 48)

      const { error: ledgerError } = await supabaseAdmin
        .from('ledger_transactions')
        .insert({
          wallet_id: walletId,
          amount: producerPayout,
          type: 'sale',
          status: 'pending',
          description: `Sale of ${item.title || 'Beat'} (${item.license_type})`,
          reference_id: reference,
          move_to_available_at: maturityDate.toISOString(),
        })

      if (!ledgerError) {
        await supabaseAdmin.rpc('increment_pending_balance', {
          p_user_id: item.producer_id,
          p_amount: producerPayout,
        })

        // Notify producer of new sale
        await supabaseAdmin.from('notifications').insert({
          user_id: item.producer_id,
          type: 'new_sale',
          title: 'New Sale!',
          body: `${buyerName} purchased "${item.title || 'your beat'}" (${item.license_type} license)`,
          link: '/dashboard/sales',
          metadata: { beat_id: item.beat_id, license_type: item.license_type, amount: producerPayout },
        })
      }

      // --- Exclusive Beat Lock ---
      if (item.license_type === 'exclusive') {
        await supabaseAdmin
          .from('beats')
          .update({ is_exclusive_sold: true, status: 'sold' })
          .eq('id', item.beat_id)
          .eq('is_exclusive_sold', false)
      }

      // --- License Generation ---
      try {
        const { generateLicenseContract, PLATFORM_DEFAULT_LICENSE } = await import('@/lib/utils/licenseGenerator')
        const { sendLicenseEmail } = await import('@/lib/utils/emailService')
        const { generateLicensePdf } = await import('@/lib/utils/pdfGenerator')

        const { data: template } = await supabaseAdmin
          .from('license_templates')
          .select('*')
          .eq('producer_id', item.producer_id)
          .eq('name', item.license_type)
          .single()

        const { data: producerProfile } = await supabaseAdmin
          .from('users_profiles')
          .select('display_name')
          .eq('id', item.producer_id)
          .single()

        const { data: beat } = await supabaseAdmin
          .from('beats')
          .select('title')
          .eq('id', item.beat_id)
          .single()

        const { data: orderItem } = await supabaseAdmin
          .from('order_items')
          .select('id')
          .eq('order_id', orderId)
          .eq('beat_id', item.beat_id)
          .eq('license_type', item.license_type)
          .single()

        const producerName = producerProfile?.display_name || 'BeatToday Producer'
        const trackTitle = beat?.title || 'Your Purchase'
        const contractText = generateLicenseContract(template?.contract_text || PLATFORM_DEFAULT_LICENSE, {
          PRODUCER_NAME: producerName,
          BUYER_NAME: buyerName,
          TRACK_TITLE: trackTitle,
          STREAM_LIMIT: template?.streaming_limit?.toLocaleString() || '50,000',
          MV_LIMIT: template?.music_video_limit?.toString() || '1',
          RADIO_RIGHTS: template?.radio_broadcasting ? 'Radio Rights Included' : 'No Radio Rights',
          DATE: new Date().toLocaleDateString(),
        })

        if (orderItem?.id) {
          await supabaseAdmin.from('order_item_licenses').insert({
            order_item_id: orderItem.id,
            buyer_id: updatedOrder.buyer_id,
            producer_id: item.producer_id,
            beat_id: item.beat_id,
            license_type: item.license_type,
            final_legal_text: contractText,
          })
        } else {
          console.warn('Missing order item for license snapshot', orderId, item.beat_id)
        }

        const pdfBuffer = await generateLicensePdf({
          orderId: orderId,
          buyerName: buyerName,
          producerName: producerName,
          trackTitle: trackTitle,
          licenseType: item.license_type,
          terms: {
            streamingLimit: template?.streaming_limit?.toLocaleString() || '50,000',
            mvLimit: template?.music_video_limit?.toString() || '1',
            radioRights: template?.radio_broadcasting ? 'Radio Rights Included' : 'No Radio Rights',
            nonProfit: template?.is_non_profit_only || false,
          },
          date: new Date().toLocaleDateString(),
        })

        if (buyerEmail) {
          await sendLicenseEmail({
            to: buyerEmail,
            buyerName: buyerName,
            trackTitle: trackTitle,
            contractHtml: contractText,
            attachments: [
              {
                filename: `License_Agreement_${trackTitle.replaceAll(/\s+/g, '_')}.pdf`,
                content: pdfBuffer,
              },
            ],
          })
        } else {
          console.warn('No buyer email available to send license for order', orderId)
        }
      } catch (fulfillError) {
        console.error('License Fulfillment Failed for item:', item.beat_id, fulfillError)
      }
    } catch (itemError) {
      console.error('Error processing item in fulfillOrder:', itemError)
    }
  }

  return updatedOrder.id
}
