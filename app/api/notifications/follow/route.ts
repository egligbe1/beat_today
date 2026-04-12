import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { following_id } = await req.json()
  if (!following_id || following_id === user.id) return NextResponse.json({ ok: true })

  const { data: follower } = await supabaseAdmin
    .from('users_profiles')
    .select('display_name, handle')
    .eq('id', user.id)
    .single()

  await supabaseAdmin.from('notifications').insert({
    user_id: following_id,
    type: 'new_follower',
    title: 'New Follower',
    body: `${follower?.display_name || 'Someone'} (@${follower?.handle || 'user'}) started following you`,
    link: `/@${follower?.handle}`,
    metadata: { follower_id: user.id }
  })

  return NextResponse.json({ ok: true })
}
