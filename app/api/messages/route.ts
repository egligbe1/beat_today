import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/messages — send a message (creates conversation if needed)
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipient_id, content, conversation_id } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  let convId = conversation_id

  if (convId) {
    // Verify the caller is actually a participant in this conversation
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('participant_1, participant_2')
      .eq('id', convId)
      .single()
    if (!conv || (conv.participant_1 !== user.id && conv.participant_2 !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    if (!recipient_id) return NextResponse.json({ error: 'Missing recipient_id' }, { status: 400 })
    if (recipient_id === user.id) return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })

    // Find or create conversation (normalize participant order)
    const [p1, p2] = [user.id, recipient_id].sort()

    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('participant_1', p1)
      .eq('participant_2', p2)
      .maybeSingle()

    if (existing) {
      convId = existing.id
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('conversations')
        .insert({ participant_1: p1, participant_2: p2 })
        .select('id')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      convId = created.id
    }
  }

  // Insert message
  const { data: message, error: msgError } = await supabaseAdmin
    .from('messages')
    .insert({ conversation_id: convId, sender_id: user.id, content: content.trim() })
    .select()
    .single()

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

  // Update conversation last_message_at
  await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId)

  // Notify recipient
  const otherUserId = recipient_id || await getOtherParticipant(convId, user.id)
  if (otherUserId) {
    const { data: sender } = await supabaseAdmin
      .from('users_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    await supabaseAdmin.from('notifications').insert({
      user_id: otherUserId,
      type: 'new_message',
      title: 'New Message',
      body: `${sender?.display_name || 'Someone'}: ${content.trim().slice(0, 60)}${content.length > 60 ? '...' : ''}`,
      link: `/messages/${convId}`,
      metadata: { conversation_id: convId }
    })
  }

  return NextResponse.json({ message, conversation_id: convId })
}

async function getOtherParticipant(convId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('participant_1, participant_2')
    .eq('id', convId)
    .single()
  if (!data) return null
  return data.participant_1 === userId ? data.participant_2 : data.participant_1
}
