import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/negotiations -> Create a new offer
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { beat_id, license_type, amount, message } = await request.json()

    const numericAmount = Number(amount)
    if (!beat_id || !license_type || !numericAmount || numericAmount <= 0 || numericAmount > 1_000_000) {
      return NextResponse.json({ error: 'Invalid offer details' }, { status: 400 })
    }

    // Derive producer_id from the beat record — never trust it from the client
    // (prevents spoofing offers/notifications to arbitrary users).
    const { data: beat } = await supabaseAdmin
      .from('beats')
      .select('id, producer_id, title')
      .eq('id', beat_id)
      .single()

    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }
    if (beat.producer_id === user.id) {
      return NextResponse.json({ error: 'You cannot make an offer on your own beat' }, { status: 400 })
    }

    const { data: offer, error } = await supabase
      .from('offers')
      .insert({
        buyer_id: user.id,
        producer_id: beat.producer_id,
        beat_id,
        license_type,
        amount: numericAmount,
        message,
        status: 'PENDING'
      })
      .select()
      .single()

    if (error) throw error

    // Notify the true beat owner (service role — cross-user insert).
    await supabaseAdmin.from('notifications').insert({
      user_id: beat.producer_id,
      type: 'new_offer',
      title: 'New Offer Received!',
      body: `You received an offer of $${numericAmount} for a ${license_type} license on "${beat.title}".`,
      link: '/dashboard/offers'
    })

    return NextResponse.json({ offer })
  } catch (error: any) {
    console.error('Error creating offer:', error)
    return NextResponse.json({ error: 'Could not create offer' }, { status: 500 })
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
