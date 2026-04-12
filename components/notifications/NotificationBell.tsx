'use client'

import { useEffect, useState, useRef } from 'react'
import { Bell, X, CheckCheck, ShoppingBag, UserPlus, Star, DollarSign, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  new_sale: <ShoppingBag className="w-4 h-4 text-accent-green" />,
  new_follower: <UserPlus className="w-4 h-4 text-blue-400" />,
  payout_processed: <DollarSign className="w-4 h-4 text-accent-gold" />,
  new_review: <Star className="w-4 h-4 text-accent-orange" />,
  new_message: <MessageCircle className="w-4 h-4 text-purple-400" />,
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function NotificationBell() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [supabase])

  useEffect(() => {
    if (!user) return

    async function fetchNotifications() {
      const res = await fetch('/api/notifications')
      const data = await res.json()
      if (res.ok) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
      setLoading(false)
    }

    fetchNotifications()

    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, supabase])

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all: true }) })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  if (!user) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-full hover:bg-white/5 text-text-muted hover:text-white transition-all group"
      >
        <Bell className="w-6 h-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-accent-orange text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black shadow-[0_0_15px_rgba(255,85,0,0.5)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-bold uppercase tracking-widest text-accent-orange hover:text-white transition-colors flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-border-subtle">
            {loading ? (
              <div className="p-6 text-center text-text-muted text-sm animate-pulse">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-text-muted opacity-30 mx-auto" />
                <p className="text-text-muted text-sm font-bold">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Wrapper = n.link ? Link : 'div'
                return (
                  <Wrapper
                    key={n.id}
                    href={n.link || '#'}
                    onClick={() => { if (!n.is_read) markRead(n.id); if (n.link) setOpen(false) }}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer ${!n.is_read ? 'bg-accent-orange/5' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {TYPE_ICONS[n.type] || <Bell className="w-4 h-4 text-text-muted" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${n.is_read ? 'text-text-muted' : 'text-white'}`}>{n.title}</p>
                      {n.body && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-accent-orange flex-shrink-0 mt-2" />
                    )}
                  </Wrapper>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
