'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Heart, Share2, Check, Link as LinkIcon } from 'lucide-react'
import { usePlayerStore } from '@/lib/stores/playerStore'
import { createClient } from '@/lib/supabase/client'

interface BeatPageActionsProps {
  beat: {
    id: string
    title: string
    producer_name: string
    cover_url: string
    mp3_preview_url: string | null
  }
}

export default function BeatPageActions({ beat }: BeatPageActionsProps) {
  const supabase = createClient()

  const currentBeat = usePlayerStore(state => state.currentBeat)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const togglePlay = usePlayerStore(state => state.togglePlay)
  const setBeat = usePlayerStore(state => state.setBeat)

  const isCurrent = currentBeat?.id === beat.id
  const active = isCurrent && isPlaying
  const hasPreview = Boolean(beat.mp3_preview_url?.trim())

  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Load auth + favorite state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('favorites')
        .select('beat_id')
        .eq('user_id', user.id)
        .eq('beat_id', beat.id)
        .maybeSingle()
        .then(({ data }) => setIsFavorited(!!data))
    })
  }, [beat.id, supabase])

  const handlePlay = () => {
    if (!hasPreview) return
    if (isCurrent) {
      togglePlay()
    } else {
      setBeat({
        id: beat.id,
        title: beat.title,
        producer_name: beat.producer_name,
        cover_url: beat.cover_url,
        mp3_preview_url: beat.mp3_preview_url!,
      })
    }
  }

  const handleFavorite = async () => {
    if (!userId) {
      window.location.href = '/login'
      return
    }
    setFavLoading(true)
    if (isFavorited) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('beat_id', beat.id)
      setIsFavorited(false)
    } else {
      await supabase.from('favorites').insert({ user_id: userId, beat_id: beat.id })
      setIsFavorited(true)
    }
    setFavLoading(false)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: `${beat.title} — BeatToday`, url })
        return
      } catch {
        // User cancelled share — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-4 mt-8">
      {/* Play Preview */}
      <button
        onClick={handlePlay}
        disabled={!hasPreview}
        className={`flex-1 h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
          hasPreview
            ? 'bg-white text-black hover:bg-white/90'
            : 'bg-white/20 text-white/40 cursor-not-allowed'
        }`}
      >
        {active ? (
          <><Pause className="w-5 h-5 fill-current" /> Pause Preview</>
        ) : (
          <><Play className="w-5 h-5 fill-current" /> {hasPreview ? 'Play Preview' : 'No Preview'}</>
        )}
      </button>

      {/* Favorite */}
      <button
        onClick={handleFavorite}
        disabled={favLoading}
        title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        className={`w-12 h-12 rounded-lg border flex items-center justify-center transition-all active:scale-95 ${
          isFavorited
            ? 'bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20'
            : 'bg-bg-surface border-border-subtle hover:text-red-400 hover:border-red-500/30'
        }`}
      >
        <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-400 text-red-400' : ''}`} />
      </button>

      {/* Share */}
      <button
        onClick={handleShare}
        title="Share this beat"
        className="w-12 h-12 bg-bg-surface rounded-lg border border-border-subtle flex items-center justify-center hover:text-accent-orange hover:border-accent-orange/30 transition-all active:scale-95"
      >
        {copied ? <Check className="w-5 h-5 text-green-400" /> : <Share2 className="w-5 h-5" />}
      </button>
    </div>
  )
}
