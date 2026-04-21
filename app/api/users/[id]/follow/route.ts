import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.id === params.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  // Check if already following
  const { data: existing } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', user.id)
    .eq('following_id', params.id)
    .single()

  if (existing) {
    // Unfollow
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ following: false })
  } else {
    // Follow
    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: params.id
      })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ following: true })
  }
}
