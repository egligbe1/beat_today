'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/utils/toast'
import { useRouter } from 'next/navigation'

interface FavoriteButtonProps {
  beatId: string
  initialIsFavorited?: boolean
  className?: string
  iconClassName?: string
}

export default function FavoriteButton({ 
  beatId, 
  initialIsFavorited = false,
  className,
  iconClassName
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // NOTE: intentionally no render-time auth/favorite query here. When many
  // FavoriteButtons render in a grid, per-card getSession()+select calls
  // create an N+1 storm. The initial state comes from the server-provided
  // `initialIsFavorited` prop; the user is resolved lazily on first click.

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading) return

    // Resolve the current user only when the button is actually used.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast.error('Please login to favorite beats')
      router.push('/login')
      return
    }
    const userId = user.id

    setLoading(true)
    const nextState = !isFavorited
    setIsFavorited(nextState) // Optimistic update

    try {
      if (nextState) {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: userId, beat_id: beatId })

        if (error) throw error
        showToast.success('Added to favorites')
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('beat_id', beatId)

        if (error) throw error
        showToast.success('Removed from favorites')
      }
      router.refresh()
    } catch (error: any) {
      console.error('Error toggling favorite:', error)
      setIsFavorited(!nextState) // Rollback
      showToast.error('Failed to update favorites')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(
        "group/fav flex items-center justify-center transition-all active:scale-95 disabled:opacity-50",
        className
      )}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart 
        className={cn(
          "transition-all duration-300",
          isFavorited ? "fill-red-500 text-red-500 scale-110" : "text-white/70 group-hover/fav:text-white group-hover/fav:scale-110",
          iconClassName
        )}
      />
    </button>
  )
}
