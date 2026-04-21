import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/negotiations/[id] -> Update offer status (ACCEPT, DECLINE, COUNTER)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status, amount, message } = await request.json()
    const offerId = params.id

    // Only the producer can accept/decline. Buyers can only counter a counter-offer.
    // For simplicity, we assume RLS checks this.

    const updateData: any = { status, updated_at: new Date().toISOString() }
    if (amount) updateData.amount = amount
    if (message) updateData.message = message

    if (status === 'ACCEPTED') {
      const expires = new Date()
      expires.setHours(expires.getHours() + 48) // Offer valid for 48 hours
      updateData.expires_at = expires.toISOString()
      // Generate a checkout URL that skips the cart and goes straight to checkout
      // We could use a standard checkout route and append ?offer_id=xxx
      updateData.checkout_url = `/checkout?offer_id=${offerId}` 
    }

    const { data: updatedOffer, error } = await supabase
      .from('offers')
      .update(updateData)
      .eq('id', offerId)
      .select()
      .single()

    if (error) throw error

    // Notify the other party depending on who made the action
    const isProducerActing = updatedOffer.producer_id === user.id
    const notifyUserId = isProducerActing ? updatedOffer.buyer_id : updatedOffer.producer_id

    await supabase.from('notifications').insert({
      user_id: notifyUserId,
      type: 'offer_update',
      title: `Offer ${status}`,
      body: `An offer has been updated to ${status}.`,
      link: isProducerActing ? '/messages' : '/dashboard/offers'
    })

    return NextResponse.json({ offer: updatedOffer })
  } catch (error: any) {
    console.error('Error updating offer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
