import { rateLimit } from '@/lib/rateLimit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, props: { params: Promise<{ beatId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('beat_comments')
    .select('*, users_profiles(handle, display_name, avatar_url)')
    .eq('beat_id', params.beatId)
    .order('created_at', { ascending: false }).limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, props: { params: Promise<{ beatId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit('app/api/beats/[beatId]/comments/route.ts:' + user.id, 20, 60))) return NextResponse.json({ error: 'Please wait' }, { status: 429 })

  const { content } = await request.json()
  if (typeof content !== 'string' || !content.trim() || content.length > 2000) return NextResponse.json({ error: 'Enter a comment of 1–2000 characters' }, { status: 400 })

  const admin = createAdminClient()
  const { data: beat } = await admin.from('beats').select('id').eq('id', params.beatId).eq('status','active').maybeSingle()
  if (!beat) return NextResponse.json({ error: 'Beat unavailable' }, { status: 404 })
  const { data, error } = await admin
    .from('beat_comments')
    .insert({
      beat_id: params.beatId,
      user_id: user.id,
      content
    })
    .select('*, users_profiles(handle, display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
