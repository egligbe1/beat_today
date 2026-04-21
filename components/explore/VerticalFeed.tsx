'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Share2, Play, Pause, ShoppingCart, ArrowLeft, Music, Plus, X, Send, Loader2, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/stores/cartStore'
import { usePlayerStore } from '@/lib/stores/playerStore'
import { useCurrency } from '@/lib/providers/CurrencyProvider'
import QuickLicensePicker from '@/components/beats/QuickLicensePicker'
import Modal from '@/components/ui/Modal'
import { formatDistanceToNow } from 'date-fns'
import dynamic from 'next/dynamic'

const Turntable = dynamic(() => import('./Turntable'), { 
  ssr: false,
  loading: () => <div className="w-full aspect-square rounded-full bg-zinc-900/50 animate-pulse" />
})

const CommentDrawer = dynamic(() => import('./CommentDrawer'), { ssr: false })

interface FeedBeat {
  id: string
  title: string
  cover_url: string
  mp3_preview_url: string
  price_mp3: number
  price_wav?: number | null
  price_trackout?: number | null
  price_exclusive?: number | null
  is_exclusive_sold?: boolean
  is_free?: boolean
  producer_id: string
  genre?: string
  bpm?: number
  key?: string
  users_profiles: {
    handle: string
    display_name: string
    avatar_url: string
  }
  likes_count: number
  comments_count: number
}

export default function VerticalFeed({ 
  initialBeats, 
  initialFollowingIds = [], 
  initialFavoritedIds = [] 
}: { 
  initialBeats: FeedBeat[],
  initialFollowingIds?: string[],
  initialFavoritedIds?: string[]
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  
  // Shared Audio Controller Logic
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isGlobalPlaying, setIsGlobalPlaying] = useState(false)
  const [globalProgress, setGlobalProgress] = useState(0)
  const audioUnlocked = useRef(false)

  // Initialize shared audio (Client side only)
  useEffect(() => {
    const audio = new Audio()
    audio.loop = true
    audioRef.current = audio

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setGlobalProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Sync Audio with activeIndex
  useEffect(() => {
    if (!audioRef.current || initialBeats.length === 0) return
    
    const activeBeat = initialBeats[activeIndex]
    if (!activeBeat) return

    const playNewBeat = async () => {
      try {
        const audio = audioRef.current!
        // Swap source
        if (audio.src !== activeBeat.mp3_preview_url) {
          audio.src = activeBeat.mp3_preview_url
          audio.load()
        }
        
        if (audioUnlocked.current) {
          await audio.play()
          setIsGlobalPlaying(true)
        }
      } catch (err) {
        console.warn("Shared autoplay blocked (waiting for interaction):", err)
        setIsGlobalPlaying(false)
      }
    }

    // Small delay to ensure swipe animation feels natural
    const timeout = setTimeout(playNewBeat, 100)
    return () => clearTimeout(timeout)
  }, [activeIndex, initialBeats])

  // Global Unlock & Interaction Handler
  const handleInteraction = () => {
    if (!audioRef.current || audioUnlocked.current) return
    audioUnlocked.current = true
    audioRef.current.play().then(() => {
      setIsGlobalPlaying(true)
    }).catch(() => {
      // Still blocked
    })
  }

  const toggleGlobalPlay = () => {
    if (!audioRef.current) return
    handleInteraction() // Unlock on first toggle if not already

    if (isGlobalPlaying) {
      audioRef.current.pause()
      setIsGlobalPlaying(false)
    } else {
      audioRef.current.play()
      setIsGlobalPlaying(true)
    }
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const setGlobalPlaying = usePlayerStore(state => state.setPlaying)

  useEffect(() => {
    // Check onboarding hint
    const hasSeen = localStorage.getItem('explore_hint_seen')
    if (!hasSeen) {
      setShowHint(true)
      // Hide hint after 5 seconds or on scroll
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setActiveIndex(index)
            if (index > 0) {
              setShowHint(false)
              localStorage.setItem('explore_hint_seen', 'true')
            }
          }
        })
      },
      { threshold: 0.6 }
    )

    const elements = document.querySelectorAll('.feed-item')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [initialBeats])

  useEffect(() => {
    const player = document.getElementById('global-player')
    if (player) player.style.display = 'none'
    setGlobalPlaying(false)
    
    return () => {
      if (player) player.style.display = ''
    }
  }, [setGlobalPlaying])

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar bg-black relative overscroll-y-contain"
    >
      <AnimatePresence>
        {showHint && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]"
          >
            <motion.div
              animate={{ y: [0, -40, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex flex-col items-center gap-4"
            >
              <ChevronUp className="w-12 h-12 text-white opacity-80" />
              <p className="text-white font-black uppercase tracking-[0.3em] text-sm drop-shadow-lg">Swipe up for more</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {initialBeats.map((beat, i) => (
        <div 
          key={beat.id} 
          data-index={i}
          className="feed-item h-full w-full snap-start overflow-hidden relative"
        >
          <EnhancedTikTokItem 
            beat={beat} 
            index={i} 
            isActive={activeIndex === i} 
            isGlobalPlaying={isGlobalPlaying}
            globalProgress={globalProgress}
            onTogglePlay={toggleGlobalPlay}
            audioRef={audioRef}
            initialFollowing={initialFollowingIds.includes(beat.producer_id)}
            initialFavorited={initialFavoritedIds.includes(beat.id)}
            user={user}
            onAuthRequired={() => setShowAuthModal(true)}
          />
        </div>
      ))}

      <Modal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Unleash Full Potential"
        description="Sign in to follow creator creators, favorite the hottest beats, and share your thoughts in the comments. Join our community of artists today."
        confirmLabel="Sign In"
        cancelLabel="Continue Exploring"
        onConfirm={() => router.push('/login?next=/explore')}
      >
        <div className="flex justify-center py-4">
           <div className="w-20 h-20 bg-[#FF2D55]/10 rounded-full flex items-center justify-center border border-[#FF2D55]/20">
              <Heart className="w-10 h-10 text-[#FF2D55] fill-current" />
           </div>
        </div>
      </Modal>
    </div>
  )
}

function EnhancedTikTokItem({ 
  beat, 
  index, 
  isActive, 
  isGlobalPlaying,
  globalProgress,
  onTogglePlay,
  audioRef,
  initialFollowing, 
  initialFavorited,
  user,
  onAuthRequired
}: { 
  beat: FeedBeat; 
  index: number; 
  isActive: boolean;
  isGlobalPlaying: boolean;
  globalProgress: number;
  onTogglePlay: () => void;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  initialFollowing: boolean;
  initialFavorited: boolean;
  user: any;
  onAuthRequired: () => void;
}) {
  const [isLiked, setIsLiked] = useState(initialFavorited)
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [likeCount, setLikeCount] = useState(beat.likes_count || 0)
  const [commentCount, setCommentCount] = useState(beat.comments_count || 0)
  const [showHeart, setShowHeart] = useState(false)
  const [showComments, setShowComments] = useState(false)
  
  const lastTap = useRef<number>(0)
  const { convertAndFormat } = useCurrency()

  const isActuallyPlaying = isActive && isGlobalPlaying
  const currentProgress = isActive ? globalProgress : 0

  const togglePlay = () => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      handleLike()
      return
    }
    lastTap.current = now
    onTogglePlay()
  }

  const handleLike = async () => {
    if (!user) {
      onAuthRequired()
      return
    }
    if (isLiked) {
      setLikeCount(prev => Math.max(0, prev - 1))
      setIsLiked(false)
    } else {
      setLikeCount(prev => prev + 1)
      setIsLiked(true)
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 800)
    }

    try {
      await fetch(`/api/beats/${beat.id}/like`, { method: 'POST' })
    } catch (e) {
       console.error("Like error", e)
    }
  }

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      onAuthRequired()
      return
    }
    setIsFollowing(true) // Optimistic
    try {
      const res = await fetch(`/api/users/${beat.producer_id}/follow`, { method: 'POST' })
      const data = await res.json()
      if (data.error) setIsFollowing(false)
    } catch (e) {
      setIsFollowing(false)
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/beats/${beat.id}`
    const shareData = {
      title: beat.title,
      text: `Check out this beat by @${beat.users_profiles.handle} on BeatToday!`,
      url: shareUrl
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        alert('Link copied to clipboard!')
      }
    } catch (e) {
      console.error("Share error", e)
    }
  }

  const rotationDuration = beat.bpm ? (240 / beat.bpm) : 2

  const coverUrl = beat.cover_url?.replace('.png', '.webp') || '/default-avatar.webp'

  return (
    <div 
      className="h-full w-full relative flex items-center justify-center overflow-hidden bg-black select-none"
      style={{ perspective: '1200px' }}
    >
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center brightness-[0.3] blur-3xl scale-110"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-16 md:p-24 overflow-hidden">
           <div 
             className="relative w-full max-w-[280px] sm:max-w-sm aspect-square flex items-center justify-center"
             style={{ transform: 'rotateX(8deg)' }}
           >
              {/* FIDELITY PRUNING: Only render heavy turntable if active or nearly active */}
              <AnimatePresence mode="wait">
                {isActive ? (
                  <Turntable key="turntable" isPlaying={isActuallyPlaying} coverUrl={coverUrl} title={beat.title} index={index} bpm={beat.bpm} />
                ) : (
                  <motion.div
                    key="cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10"
                  >
                    <Image src={coverUrl} alt={beat.title} fill className="object-cover" priority={index === 0} />
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center z-40 mt-safe">
         <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg">
            <ArrowLeft className="w-5 h-5" />
         </Link>
      </div>

      {/* Interactivity Overlay */}
      <div 
        className="absolute inset-0 z-10 flex items-center justify-center" 
        onClick={togglePlay}
      >
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "backOut" }}
              className="pointer-events-none"
            >
              <Heart className="w-40 h-40 text-[#FF2D55] fill-current drop-shadow-[0_0_40px_rgba(255,45,85,0.8)]" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isActuallyPlaying && !showHeart && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.2 }}
               className="pointer-events-none"
             >
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-2xl">
                   <Play className="w-10 h-10 text-white fill-current ml-1.5" />
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar Actions (TikTok Style) */}
      <div className="absolute top-[35%] bottom-[160px] right-2 sm:right-4 flex flex-col justify-end items-center gap-5 sm:gap-7 z-[60] pb-[env(safe-area-inset-bottom)]">
        
        {/* Profile Action */}
        <div className="relative group">
           <Link href={`/${beat.users_profiles.handle}`} className="block">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white shadow-[0_0_30px_rgba(0,0,0,0.6)] overflow-hidden transition-transform group-hover:rotate-6 active:scale-90">
                 <img src={beat.users_profiles.avatar_url || '/default-avatar.webp'} alt={`${beat.users_profiles.display_name} avatar`} className="w-full h-full object-cover" />
              </div>
           </Link>
           {!isFollowing && (
             <button 
               onClick={handleFollow}
               className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 sm:w-7 sm:h-7 bg-[#FF2D55] text-white rounded-full flex items-center justify-center border-2 border-white shadow-xl hover:scale-110 active:scale-90 transition-all z-10"
             >
                <Plus className="w-4 h-4 fill-current stroke-[3]" />
             </button>
           )}
        </div>

        {/* Like Action */}
        <button 
          onClick={(e) => { e.stopPropagation(); handleLike() }} 
          className="flex flex-col items-center group"
        >
          <div className="p-1 transition-all group-hover:scale-125 group-hover:drop-shadow-[0_0_15px_rgba(255,45,85,0.5)]">
            <Heart className={`w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)] transition-colors ${isLiked ? 'text-[#FF2D55] fill-current' : 'text-white'}`} />
          </div>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)] -mt-1 tracking-wider">{likeCount.toLocaleString()}</span>
        </button>

        {/* Comment Action */}
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (!user) {
              onAuthRequired()
            } else {
              setShowComments(true)
            }
          }} 
          className="flex flex-col items-center group"
        >
          <div className="p-1 transition-all group-hover:scale-125">
             <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)]" />
          </div>
          <span className="text-xs font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)] -mt-1 tracking-wider">{commentCount.toLocaleString()}</span>
        </button>

        {/* Share Action */}
        <button 
          onClick={handleShare} 
          className="flex flex-col items-center group"
        >
          <div className="p-1 transition-all group-hover:scale-125">
             <Share2 className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)]" />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-tighter opacity-90 drop-shadow-md">Share</span>
        </button>

        {/* Commerce Action */}
        <div onClick={(e) => e.stopPropagation()} className="mt-2 scale-100 sm:scale-125">
          <QuickLicensePicker beat={{
            id: beat.id,
            title: beat.title,
            producer_name: beat.users_profiles.display_name,
            producer_id: beat.producer_id,
            cover_url: beat.cover_url,
            price_mp3: beat.price_mp3,
            price_wav: beat.price_wav,
            price_trackout: beat.price_trackout,
            price_exclusive: beat.price_exclusive,
                        is_exclusive_sold: beat.is_exclusive_sold,
            is_free: beat.is_free,
          }} />
        </div>

        {/* Static Vinyl Visual Aid */}
        <Link 
          href={`/beats/${beat.id}`}
          className="mt-6 relative px-1 hidden sm:block group pointer-events-auto"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-800 to-black p-[3px] shadow-2xl relative overflow-hidden transition-transform group-hover:scale-110 group-active:scale-95">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(255,255,255,0.05)_41%,_transparent_42%,_rgba(255,255,255,0.05)_43%,_transparent_44%)]" />
            <div className="w-full h-full rounded-full overflow-hidden border border-white/5 relative">
               <img src={coverUrl} className="w-full h-full object-cover grayscale-[0.2]" alt="vinyl" />
               <div className="absolute inset-0 bg-black/40" />
            </div>
            
            {/* Center Pin Hole */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-zinc-800 border border-white/20 z-10 shadow-inner" />
          </div>

          {isActuallyPlaying && (
            <div className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2D55] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#FF2D55]"></span>
            </div>
          )}
        </Link>
      </div>

      {/* Info Overlay (Cinema Mode) */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute bottom-[100px] left-4 right-20 z-40 pointer-events-none mb-[env(safe-area-inset-bottom)]"
      >
        <div className="space-y-4 max-w-sm">
           <div className="space-y-1">
              <Link href={`/beats/${beat.id}`} className="pointer-events-auto block transition-transform active:scale-[0.98]">
                <h2 className="text-3xl sm:text-4xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)] truncate uppercase tracking-tighter italic leading-none hover:text-[#FF2D55] transition-colors">
                  {beat.title}
                </h2>
              </Link>
              <div className="flex items-center gap-2">
                 <Link href={`/${beat.users_profiles.handle}`} className="pointer-events-auto text-base sm:text-lg font-black text-white hover:text-[#FF2D55] transition-colors drop-shadow-md">
                    @{beat.users_profiles.handle}
                 </Link>
                 <span className="w-1.5 h-1.5 rounded-full bg-[#FF2D55] shadow-[0_0_10px_#FF2D55]" />
                 <span className="text-xs font-black text-white/70 uppercase tracking-[0.2em]">{beat.genre || 'Beat'}</span>
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-2xl border border-white/20 shadow-xl text-xs font-black text-white uppercase tracking-widest">
                 <Music className="w-4 h-4 text-[#FF2D55]" /> {beat.bpm} BPM
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-2xl backdrop-blur-2xl border border-white/20 shadow-xl text-xs font-black text-white uppercase tracking-widest">
                 {beat.key}
              </div>
           </div>
        </div>
      </motion.div>

       {/* Bottom Timeline (Seeking Enabled) - Only if active */}
      {isActive && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-4 flex items-end cursor-pointer z-[70] group/seek"
          onClick={(e) => {
            e.stopPropagation()
            if (!audioRef.current || !audioRef.current.duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const percentage = x / rect.width
            audioRef.current.currentTime = percentage * audioRef.current.duration
          }}
        >
          <div className="w-full h-[2px] bg-white/10 relative">
            <motion.div 
              initial={{ scaleX: 0 }} 
              animate={{ scaleX: currentProgress / 100 }} 
              transition={{ ease: "linear" }} 
              className="h-full bg-[#FF2D55] origin-left shadow-[0_0_8px_#FF2D55]" 
            />
            <motion.div 
              style={{ left: `${currentProgress}%` }}
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/seek:opacity-100 transition-opacity"
            />
          </div>
        </div>
      )}

      {/* Comment Drawer */}
      <AnimatePresence>
        {showComments && (
           <CommentDrawer 
             beatId={beat.id} 
             onClose={() => setShowComments(false)} 
             onCommentAdded={() => setCommentCount(prev => prev + 1)}
           />
        )}
      </AnimatePresence>
    </div>
  )
}

