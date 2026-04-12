import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import MessageThread from './MessageThread'

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/messages')

  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      id,
      p1:users_profiles!participant_1(id, display_name, avatar_url, handle),
      p2:users_profiles!participant_2(id, display_name, avatar_url, handle)
    `)
    .eq('id', params.id)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .single()

  if (!conversation) return notFound()

  const other = (conversation.p1 as any)?.id === user.id ? conversation.p2 as any : conversation.p1 as any

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  // Mark messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', params.id)
    .neq('sender_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-surface/80 backdrop-blur-xl border-b border-border-subtle px-4 py-4 flex items-center gap-4">
        <Link href="/messages" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-text-muted hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-bg-elevated flex-shrink-0">
          {other?.avatar_url ? (
            <Image src={other.avatar_url} alt={other.display_name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center font-bold text-text-muted">
              {other?.display_name?.[0] || '?'}
            </div>
          )}
        </div>
        <div>
          <p className="font-bold text-white">{other?.display_name}</p>
          <Link href={`/@${other?.handle}`} className="text-xs text-accent-orange hover:underline">@{other?.handle}</Link>
        </div>
      </div>

      {/* Thread */}
      <MessageThread
        conversationId={params.id}
        currentUserId={user.id}
        initialMessages={messages || []}
        otherUser={other}
      />
    </div>
  )
}
