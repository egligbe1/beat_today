'use client'

import { useLiveRefresh } from '@/lib/hooks/useLiveRefresh'
import { useEffect, useState, useRef } from 'react'
import { Bell, X, CheckCheck, ShoppingBag, UserPlus, Star, DollarSign, MessageCircle } from 'lucide-react'
import Link from 'next/link'

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

export default function NotificationBell({userId,kind='general'}:{userId:string;kind?:'general'|'messages'}) {
  const isMessages=kind==='messages'
  const title=isMessages?'Messages':'Notifications'
  const Icon=isMessages?MessageCircle:Bell
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  const requestNumber = useRef(0)
  useEffect(()=>{++requestNumber.current;setNotifications([]);setUnreadCount(0);setLoading(true)},[userId,kind])
  async function fetchNotifications() {
    const number=++requestNumber.current
    try {
      const res=await fetch('/api/notifications?kind='+kind,{cache:'no-store'})
      const data=await res.json()
      if(res.ok&&number===requestNumber.current){setNotifications(data.notifications||[]);setUnreadCount(data.unread_count||0)}
    } finally {if(number===requestNumber.current)setLoading(false)}
  }
  useLiveRefresh(fetchNotifications,userId?[{table:'notifications',filter:`user_id=eq.${userId}`}]:[],!!userId,10000)
  useEffect(()=>{
    const refresh=()=>{if(userId)void fetchNotifications().catch(()=>{})}
    window.addEventListener('beattoday:notifications-refresh',refresh)
    return()=>window.removeEventListener('beattoday:notifications-refresh',refresh)
  },[userId,kind])
  useEffect(()=>{if(open&&userId)void fetchNotifications().catch(()=>{})},[open,userId,kind])

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
    const response=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({mark_all:true,kind})}).catch(()=>null)
    if(response?.ok){++requestNumber.current;setNotifications(prev=>prev.map(n=>({...n,is_read:true})));setUnreadCount(0);void fetchNotifications().catch(()=>{})}
  }
  const markRead = async (id:string) => {
    const response=await fetch('/api/notifications',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[id],kind})}).catch(()=>null)
    if(response?.ok){++requestNumber.current;setNotifications(prev=>prev.map(n=>n.id===id?{...n,is_read:true}:n));void fetchNotifications().catch(()=>{})}
  }

  if (!userId) return null

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label={unreadCount?`${title}, ${unreadCount} unread`:title}
        aria-expanded={open}
        title={title}
        onClick={() => setOpen(o => !o)}
        className="relative p-2 sm:p-2.5 rounded-full hover:bg-white/5 text-text-muted hover:text-white transition-all group"
      >
        <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-accent-orange text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black shadow-[0_0_15px_rgba(255,85,0,0.5)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
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
                <Icon className="w-8 h-8 text-text-muted opacity-30 mx-auto" />
                <p className="text-text-muted text-sm font-bold">{isMessages?'No message alerts yet':'No notifications yet'}</p>
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
          {isMessages&&<Link href="/messages" onClick={()=>setOpen(false)} className="block px-4 py-3 text-sm font-bold text-accent-orange border-t border-border-subtle hover:bg-white/5">Open all messages →</Link>}
        </div>
      )}
    </div>
  )
}
