import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Search } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Messages — BeatToday' }

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/messages')

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id, last_message_at,
      p1:users_profiles!participant_1(id, display_name, avatar_url, handle),
      p2:users_profiles!participant_2(id, display_name, avatar_url, handle)
    `)
    .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
    .order('last_message_at', { ascending: false })

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Messages</h1>
            <p className="text-text-muted text-sm mt-1">Your conversations with producers and artists.</p>
          </div>
        </div>

        <div className="space-y-2">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv: any) => {
              const other = conv.p1?.id === user.id ? conv.p2 : conv.p1
              if (!other) return null
              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className="flex items-center gap-4 p-4 bg-bg-surface rounded-2xl border border-border-subtle hover:border-accent-orange/30 transition-all group"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-bg-elevated flex-shrink-0">
                    {other.avatar_url ? (
                      <Image src={other.avatar_url} alt={other.display_name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center font-bold text-text-muted">
                        {other.display_name?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white group-hover:text-accent-orange transition-colors">{other.display_name}</p>
                    <p className="text-xs text-text-muted">@{other.handle}</p>
                  </div>
                  <p className="text-xs text-text-muted flex-shrink-0">
                    {new Date(conv.last_message_at).toLocaleDateString()}
                  </p>
                </Link>
              )
            })
          ) : (
            <div className="text-center py-20 bg-bg-surface rounded-3xl border border-border-subtle space-y-4">
              <MessageCircle className="w-12 h-12 text-text-muted opacity-30 mx-auto" />
              <p className="font-bold text-text-muted">No conversations yet</p>
              <p className="text-sm text-text-muted">Start a conversation by visiting a producer&apos;s profile and clicking Contact.</p>
              <Link href="/search" className="inline-flex items-center gap-2 px-6 py-3 bg-accent-orange text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-[#ff6a1f] transition-all">
                <Search className="w-4 h-4" /> Browse Producers
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
