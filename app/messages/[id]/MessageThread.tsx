'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Message {
  id: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean
}

interface Props {
  conversationId: string
  currentUserId: string
  initialMessages: Message[]
  otherUser: { id: string; display_name: string; avatar_url: string | null }
}

import { showToast } from '@/lib/utils/toast'

export default function MessageThread({ conversationId, currentUserId, initialMessages, otherUser }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, supabase])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return

    setSending(true)
    const content = input.trim()
    setInput('')

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, content })
    })

    const data = await res.json()
    if (!res.ok) {
      showToast.error(data.error || 'Failed to send message')
      setInput(content)
    }
    setSending(false)
  }

  function groupByDate(msgs: Message[]) {
    const groups: { date: string; messages: Message[] }[] = []
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      const last = groups[groups.length - 1]
      if (last?.date === date) {
        last.messages.push(msg)
      } else {
        groups.push({ date, messages: [msg] })
      }
    })
    return groups
  }

  const groups = groupByDate(messages)

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4">
      {/* Messages */}
      <div className="flex-1 py-6 space-y-6 overflow-y-auto min-h-[60vh]">
        {messages.length === 0 && (
          <div className="text-center py-16 text-text-muted text-sm">
            No messages yet. Say hello!
          </div>
        )}

        {groups.map(group => (
          <div key={group.date} className="space-y-3">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-bg-surface px-3 py-1 rounded-full border border-border-subtle">
                {group.date}
              </span>
            </div>
            {group.messages.map(msg => {
              const isMine = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && (
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-bg-elevated flex-shrink-0">
                      {otherUser.avatar_url ? (
                        <Image src={otherUser.avatar_url} alt={otherUser.display_name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                          {otherUser.display_name?.[0]}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                      isMine
                        ? 'bg-accent-orange text-white rounded-br-sm'
                        : 'bg-bg-surface border border-border-subtle text-white rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60 text-right' : 'text-text-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="sticky bottom-0 pb-6 pt-3 bg-bg-primary">
        <div className="flex gap-3 items-center bg-bg-surface border border-border-subtle rounded-2xl px-4 py-3 focus-within:border-accent-orange transition-colors">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="w-9 h-9 bg-accent-orange rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#ff6a1f] transition-colors active:scale-95"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
