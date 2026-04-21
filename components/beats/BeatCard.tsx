'use client'

import Link from 'next/link'
import { Play, Pause, Loader2 } from 'lucide-react'
import { usePlayerStore } from '@/lib/stores/playerStore'
import { cn } from '@/lib/utils'
import TrackImage from './TrackImage'
import QuickLicensePicker from './QuickLicensePicker'
import FavoriteButton from './FavoriteButton'

interface BeatCardProps {
  beat: {
    id: string
    title: string
    genre: string
    bpm: number
    price_mp3: number
    price_wav?: number | null
    price_trackout?: number | null
    price_exclusive?: number | null
    is_exclusive_sold?: boolean
    is_free?: boolean
    cover_url: string
    mp3_preview_url: string | null
    producer_id: string
    play_count?: number
    users_profiles: {
      handle: string
      display_name: string
    }
  }
  priority?: boolean
}

export default function BeatCard({ beat, priority }: BeatCardProps) {
  const currentBeat = usePlayerStore(state => state.currentBeat)
  const isPlaying = usePlayerStore(state => state.isPlaying)
  const togglePlay = usePlayerStore(state => state.togglePlay)
  const setBeat = usePlayerStore(state => state.setBeat)
  const hasPreview = Boolean(beat.mp3_preview_url && beat.mp3_preview_url.trim())

  const isCurrent = currentBeat?.id === beat.id
  const active = isCurrent && isPlaying

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!hasPreview) return
    if (isCurrent) {
      togglePlay()
    } else {
      setBeat({
        id: beat.id,
        title: beat.title,
        producer_name: beat.users_profiles.display_name,
        cover_url: beat.cover_url,
        mp3_preview_url: beat.mp3_preview_url || '',
      })
    }
  }

  return (
    <div className="group flex flex-col gap-3 relative">
      <div className="relative aspect-square overflow-hidden bg-bg-elevated rounded-2xl shadow-xl border border-white/5 transition-all group-hover:shadow-[0_0_30px_rgba(255,85,0,0.2)] group-hover:border-[#FF5500]/50">
        <TrackImage 
          src={beat.cover_url} 
          alt={beat.title} 
          priority={priority} 
          className="group-hover:scale-105 transition-transform duration-700"
        />

        {/* Favorite Button Overlay */}
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
          <FavoriteButton 
            beatId={beat.id} 
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg"
            iconClassName="w-5 h-5"
          />
        </div>

        
        {/* Play overlay — always visible on mobile, hover on desktop */}
        <div className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        )}>
          <button
            onClick={handlePlay}
            disabled={!hasPreview}
            className={cn(
              "bg-[#FF5500] text-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,85,0,0.5)] transition-transform active:scale-90",
              "w-14 h-14 sm:w-20 sm:h-20",
              "scale-100 sm:scale-75 group-hover:scale-100",
              !hasPreview && "opacity-60 cursor-not-allowed shadow-none"
            )}
          >
            {hasPreview ? (
              active ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-current" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current ml-0.5 sm:ml-1" />
            ) : (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin opacity-70" />
            )}
          </button>
        </div>
      </div>
      
      {/* Metadata below artwork */}
      <div className="px-1 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <Link href={`/beats/${beat.id}`} className="block">
                <h3 className="font-black text-base sm:text-lg text-white truncate hover:text-[#FF5500] transition-colors leading-tight italic uppercase tracking-tighter">
                    {beat.title}
                </h3>
                </Link>
                <Link href={`/@${beat.users_profiles.handle}`} className="text-xs font-bold text-text-muted hover:text-white transition-colors truncate block mt-0.5 uppercase tracking-widest opacity-70">
                {beat.users_profiles.display_name}
                </Link>
            </div>
            <div className="flex-shrink-0 pt-0.5">
              <QuickLicensePicker beat={{
                id: beat.id,
                title: beat.title,
                producer_name: beat.users_profiles.display_name,
                cover_url: beat.cover_url,
                price_mp3: beat.price_mp3,
                price_wav: beat.price_wav,
                price_trackout: beat.price_trackout,
                price_exclusive: beat.price_exclusive,
                is_exclusive_sold: beat.is_exclusive_sold,
                is_free: beat.is_free,
                producer_id: beat.producer_id,
              }} />
            </div>
        </div>
        
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_8px_#FF5500]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5500]">
                    {beat.genre}
                </span>
            </div>
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded leading-none">
                {beat.bpm} BPM
            </span>
            {typeof beat.play_count === 'number' && (
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1 opacity-60">
                  <Play className="w-3 h-3 fill-current" /> {beat.play_count.toLocaleString()}
              </span>
            )}
        </div>
      </div>
    </div>
  )
}
