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
  payoutRatio = 1,
  promoCodeId = null,
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
  // Fraction of full price actually collected (1 = no discount). Producer
  // payouts are computed on the collected amount, not the pre-discount price.
  payoutRatio?: number
  promoCodeId?: string | null
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
      // --- Producer Payout Logic & Splits ---
      // 1. Fetch splits
      const { data: collaborators } = await supabaseAdmin
        .from('beat_collaborators')
        .select('collaborator_id, split_percentage')
        .eq('beat_id', item.beat_id)
      
      const collabs = collaborators || []
      const totalCollabPercent = collabs.reduce((sum, c) => sum + Number(c.split_percentage), 0)
      const primaryPercent = Math.max(0, 100 - totalCollabPercent)
      
      const splits = [
        { user_id: item.producer_id, percentage: primaryPercent },
        ...collabs.map(c => ({ user_id: c.collaborator_id, percentage: Number(c.split_percentage) }))
      ].filter(s => s.percentage > 0)

      // 2. Fetch primary producer settings for Platform Fee
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
      // Pay out on the amount actually collected (applies any order discount),
      // converted to wallet currency, less the platform cut.
      const itemAmountInCheckoutCurrency = itemPriceUsd * payoutRatio * conversionRate
      const totalProducerPayout = itemAmountInCheckoutCurrency * (1 - platformCutPercentage)

      const round2 = (n: number) => Math.round(n * 100) / 100

      // 3. Process payouts for each split
      for (const split of splits) {
        const splitPayout = round2(totalProducerPayout * (split.percentage / 100))
        if (splitPayout <= 0) continue

        const { error: ledgerError } = await supabaseAdmin
          .from('ledger_transactions')
          .insert({
            producer_id: split.user_id,
            amount: splitPayout,
            type: 'SALE',
            status: 'PENDING',
            description: `Sale of ${item.title || 'Beat'} (${item.license_type}) - Split (${split.percentage}%)`,
            reference_id: reference,
          })

        if (!ledgerError) {
          // Atomic credit — also creates the wallet row if missing (upsert).
          const { error: creditError } = await supabaseAdmin.rpc('credit_pending_balance', {
            p_producer_id: split.user_id,
            p_amount: splitPayout,
          })
          if (creditError) console.error('credit_pending_balance failed for', split.user_id, creditError)

          // Notify producer of new sale
          await supabaseAdmin.from('notifications').insert({
            user_id: split.user_id,
            type: 'new_sale',
            title: split.percentage === 100 ? 'New Sale!' : 'New Sale (Collab Split)!',
            body: `${buyerName} purchased "${item.title || 'a beat'}" (${item.license_type} license). Your split: ${split.percentage}%`,
            link: '/dashboard/sales',
            metadata: { beat_id: item.beat_id, license_type: item.license_type, amount: splitPayout },
          })
        }
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
        const { generateLicenseContract, PLATFORM_DEFAULT_LICENSE, LICENSE_DEFAULTS } = await import('@/lib/utils/licenseGenerator')
        const { sendLicenseEmail } = await import('@/lib/utils/emailService')
        const { generateLicensePdf } = await import('@/lib/utils/pdfGenerator')

        // Map checkout license types to internal template/default keys
        const licenseTypeMap: Record<string, string> = {
          mp3: 'basic',
          wav: 'premium',
          trackout: 'unlimited',
          exclusive: 'exclusive'
        }
        const internalLicenseType = licenseTypeMap[item.license_type] || item.license_type

        const { data: template } = await supabaseAdmin
          .from('license_templates')
          .select('*')
          .eq('producer_id', item.producer_id)
          .eq('type', internalLicenseType)
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
        
        // Use custom template if exists, else use the industry standard default for this specific license type
        const baseTemplate = template?.contract_text || 
                           LICENSE_DEFAULTS[internalLicenseType as keyof typeof LICENSE_DEFAULTS]?.contract_text || 
                           PLATFORM_DEFAULT_LICENSE

        const contractText = generateLicenseContract(baseTemplate, {
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

  // Count the promo redemption exactly once (this block runs once per order
  // thanks to the atomic pending->completed status flip above).
  if (promoCodeId) {
    const { error: promoError } = await supabaseAdmin.rpc('increment_promo_usage', {
      p_promo_id: promoCodeId,
    })
    if (promoError) console.error('increment_promo_usage failed for', promoCodeId, promoError)
  }

  return updatedOrder.id
}
