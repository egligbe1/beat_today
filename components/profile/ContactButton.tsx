'use client'

import { useState } from 'react'
import { MessageCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { showToast } from '@/lib/utils/toast'

export default function ContactButton({ producerId, className, initialMessage = 'Hi! I wanted to reach out about your beats.' }: { producerId: string, className?: string, initialMessage?: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleContact = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?redirect='+encodeURIComponent(window.location.pathname+window.location.search)); return }
    if (user.id === producerId) return

    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: producerId, content: initialMessage })
      })
      const data = await res.json()
      if (!res.ok || !data.conversation_id) throw new Error('Unable to start conversation')
      if (data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`)
      }
    } catch {
      showToast.error('Failed to start conversation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleContact}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 px-6 h-11 rounded-xl font-bold transition-all active:scale-95 bg-bg-elevated border border-border-subtle text-text-primary hover:bg-bg-surface disabled:opacity-50",
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
      Contact
    </button>
  )
}
