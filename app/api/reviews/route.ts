import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/reviews?beat_id=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const beatId = searchParams.get('beat_id')
  if (!beatId) return NextResponse.json({ error: 'Missing beat_id' }, { status: 400 })

  const { data: reviews, error } = await supabaseAdmin
    .from('beat_reviews')
    .select('*, reviewer:users_profiles!reviewer_id(display_name, avatar_url, handle)')
    .eq('beat_id', beatId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const avg = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null

  return NextResponse.json({ reviews, avg_rating: avg, total: reviews?.length || 0 })
}

// POST /api/reviews
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { beat_id, rating, comment } = body

  if (!beat_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Verify user purchased this beat
  const { data: verifiedPurchase } = await supabaseAdmin
    .from('order_items')
    .select('id, orders!inner(buyer_id, status)')
    .eq('beat_id', beat_id)
    .eq('orders.buyer_id', user.id)
    .eq('orders.status', 'completed')
    .limit(1)
    .maybeSingle()

  if (!verifiedPurchase) {
    return NextResponse.json({ error: 'You must purchase this beat before reviewing it.' }, { status: 403 })
  }

  // Upsert review
  const { data, error } = await supabaseAdmin
    .from('beat_reviews')
    .upsert(
      { beat_id, reviewer_id: user.id, rating, comment: comment || null, updated_at: new Date().toISOString() },
      { onConflict: 'beat_id,reviewer_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the beat producer
  const { data: beat } = await supabaseAdmin
    .from('beats')
    .select('producer_id, title')
    .eq('id', beat_id)
    .single()

  if (beat && beat.producer_id !== user.id) {
    const { data: reviewer } = await supabaseAdmin
      .from('users_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await supabaseAdmin.from('notifications').insert({
      user_id: beat.producer_id,
      type: 'new_review',
      title: 'New Review',
      body: `${reviewer?.display_name || 'Someone'} left a ${rating}★ review on "${beat.title}"`,
      link: `/beats/${beat_id}`,
      metadata: { beat_id, rating }
    })
  }

  return NextResponse.json({ review: data })
}

// DELETE /api/reviews?beat_id=xxx
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const beatId = searchParams.get('beat_id')
  if (!beatId) return NextResponse.json({ error: 'Missing beat_id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('beat_reviews')
    .delete()
    .eq('beat_id', beatId)
    .eq('reviewer_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
