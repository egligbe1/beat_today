'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
  followingId: string
  initialIsFollowing: boolean
  className?: string
}

import { showToast } from '@/lib/utils/toast'

export default function FollowButton({ followingId, initialIsFollowing, className }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [supabase.auth])

  const handleFollow = async () => {
    if (!user) return showToast.info('Please login to follow producers.')
    
    setLoading(true)
    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId)
      
      if (!error) setIsFollowing(false)
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: followingId
        })

      if (!error) {
        setIsFollowing(true)
        // Fire follow notification via API
        fetch('/api/notifications/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ following_id: followingId })
        }).catch(() => {})
      }
    }
    setLoading(false)
  }

  if (user?.id === followingId) return null

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={cn(
        "flex items-center justify-center gap-2 px-6 h-11 rounded-xl font-bold transition-all active:scale-95",
        isFollowing 
            ? "bg-bg-elevated border border-border-subtle text-text-primary hover:bg-bg-surface" 
            : "bg-accent-gold text-black hover:bg-opacity-90 shadow-lg shadow-accent-gold/10",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
            <UserMinus className="w-4 h-4" />
            Following
        </>
      ) : (
        <>
            <UserPlus className="w-4 h-4" />
            Follow
        </>
      )}
    </button>
  )
}
