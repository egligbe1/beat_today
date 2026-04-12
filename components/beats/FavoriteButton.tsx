'use client'

import { useState, useEffect } from 'react'
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
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id || null)
      
      if (session?.user?.id) {
        // Check if actually favorited if initialIsFavorited not provided
        const { data } = await supabase
          .from('beat_favorites')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('beat_id', beatId)
          .single()
        
        if (data) setIsFavorited(true)
      }
    }
    getSession()
  }, [beatId, supabase])

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!userId) {
      showToast.error('Please login to favorite beats')
      router.push('/login')
      return
    }

    if (loading) return

    setLoading(true)
    const nextState = !isFavorited
    setIsFavorited(nextState) // Optimistic update

    try {
      if (nextState) {
        const { error } = await supabase
          .from('beat_favorites')
          .insert({ user_id: userId, beat_id: beatId })
        
        if (error) throw error
        showToast.success('Added to favorites')
      } else {
        const { error } = await supabase
          .from('beat_favorites')
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
