import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/promo?code=XXX — validate a promo code at checkout
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.toUpperCase()
  const orderAmount = parseFloat(searchParams.get('amount') || '0')

  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const { data: promo } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (!promo) return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 404 })

  // Check expiry
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This promo code has expired' }, { status: 410 })
  }

  // Check max uses
  if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
    return NextResponse.json({ error: 'This promo code has reached its usage limit' }, { status: 410 })
  }

  // Check minimum order
  if (orderAmount < (promo.min_order_amount || 0)) {
    return NextResponse.json({
      error: `Minimum order amount is $${promo.min_order_amount} for this code`
    }, { status: 400 })
  }

  // Calculate discount
  let discountAmount = 0
  if (promo.discount_type === 'percentage') {
    discountAmount = (orderAmount * promo.discount_value) / 100
  } else {
    discountAmount = Math.min(promo.discount_value, orderAmount)
  }

  return NextResponse.json({
    valid: true,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discount_amount: Math.round(discountAmount * 100) / 100,
    final_amount: Math.max(0, orderAmount - discountAmount),
  })
}

// POST /api/promo — create a promo code (producer only)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'producer') {
    return NextResponse.json({ error: 'Only producers can create promo codes' }, { status: 403 })
  }

  const { data: prodSettings } = await supabaseAdmin
    .from('producer_settings')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .single()

  const tier = (prodSettings?.subscription_tier || 'free').toLowerCase()
  if (tier !== 'starter' && tier !== 'pro') {
    return NextResponse.json({ error: 'Promo codes require a STARTER or PRO subscription.' }, { status: 403 })
  }

  const body = await req.json()
  const { code, discount_type, discount_value, max_uses, min_order_amount, expires_at } = body

  if (!code || !discount_type || !discount_value) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['percentage', 'fixed'].includes(discount_type)) {
    return NextResponse.json({ error: 'Invalid discount_type' }, { status: 400 })
  }

  if (discount_type === 'percentage' && (discount_value <= 0 || discount_value > 100)) {
    return NextResponse.json({ error: 'Percentage must be between 1 and 100' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .insert({
      producer_id: user.id,
      code: code.toUpperCase().replace(/\s+/g, ''),
      discount_type,
      discount_value: Number(discount_value),
      max_uses: max_uses ? Number(max_uses) : null,
      min_order_amount: min_order_amount ? Number(min_order_amount) : 0,
      expires_at: expires_at || null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This promo code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ promo: data })
}

// DELETE /api/promo?id=xxx
export async function DELETE(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('promo_codes')
    .delete()
    .eq('id', id)
    .eq('producer_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
