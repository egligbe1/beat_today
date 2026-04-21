import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/negotiations -> Create a new offer
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { beat_id, producer_id, license_type, amount, message } = await request.json()

    if (!beat_id || !producer_id || !license_type || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: offer, error } = await supabase
      .from('offers')
      .insert({
        buyer_id: user.id,
        producer_id,
        beat_id,
        license_type,
        amount,
        message,
        status: 'PENDING'
      })
      .select()
      .single()

    if (error) throw error

    // Create a notification for the producer
    await supabase.from('notifications').insert({
      user_id: producer_id,
      type: 'new_offer',
      title: 'New Offer Received!',
      body: `You received an offer of $${amount} for a ${license_type} license.`,
      link: '/dashboard/offers'
    })

    return NextResponse.json({ offer })
  } catch (error: any) {
    console.error('Error creating offer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/negotiations -> Get user's offers (sent or received)
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Since we have RLS policies, simple select will get the right offers
    const { data: offers, error } = await supabase
      .from('offers')
      .select('*, beats(title, cover_url)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ offers })
  } catch (error: any) {
    console.error('Error fetching offers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
