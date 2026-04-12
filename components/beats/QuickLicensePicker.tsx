import { useState, useRef, useEffect } from 'react'
import { ShoppingCart, Check, X, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/stores/cartStore'
import { useCurrency } from '@/lib/providers/CurrencyProvider'
import { useOwnedLicenses } from '@/lib/hooks/useOwnedLicenses'
import Link from 'next/link'
import { createPortal } from 'react-dom'

interface Beat {
  id: string
  title: string
  producer_name: string
  cover_url: string
  price_mp3: number
  price_wav?: number | null
  price_trackout?: number | null
  price_exclusive?: number | null
  is_exclusive_sold?: boolean
  is_free?: boolean
}

interface Props {
  beat: Beat
}

const LICENSE_LABELS: Record<string, string> = {
  mp3: 'MP3 Lease',
  wav: 'WAV Lease',
  trackout: 'Stems / Trackout',
  exclusive: 'Exclusive Rights',
}

export default function QuickLicensePicker({ beat }: Props) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const addItem = useCartStore(s => s.addItem)
  const { convertAndFormat } = useCurrency()
  const { ownedLicenses, isOwned } = useOwnedLicenses(beat.id)
  const ref = useRef<HTMLDivElement>(null)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close on outside click for desktop
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!isMobile && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open && !isMobile) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, isMobile])

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, isMobile])

  const tiers = [
    { key: 'mp3', price: beat.is_free ? 0 : beat.price_mp3, owned: isOwned('mp3') },
    { key: 'wav', price: beat.price_wav ?? null, owned: isOwned('wav') },
    { key: 'trackout', price: beat.price_trackout ?? null, owned: isOwned('trackout') },
    { key: 'exclusive', price: beat.is_exclusive_sold ? null : (beat.price_exclusive ?? null), locked: !!beat.is_exclusive_sold, owned: isOwned('exclusive') },
  ].filter(t => t.price !== null || t.locked)

  const handleSelect = (key: string, price: number) => {
    addItem({
      beat_id: beat.id,
      title: beat.title,
      producer_name: beat.producer_name,
      cover_url: beat.cover_url || '',
      license_type: key as any,
      price,
    })
    setAdded(true)
    setOpen(false)
    setTimeout(() => setAdded(false), 2000)
  }

  const pickerContent = (
    <motion.div
      initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -10 }}
      animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
      exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -10 }}
      className={isMobile 
        ? "fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border-subtle rounded-t-3xl shadow-2xl z-[100] overflow-hidden"
        : "absolute bottom-full right-0 mb-2 w-52 bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl z-[60] overflow-hidden"
      }
    >
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Choose License</p>
        <button onClick={() => setOpen(false)} className="p-2 -mr-2 text-text-muted hover:text-white transition-colors">
          <X className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </div>
      <div className="max-h-[60vh] sm:max-h-[300px] overflow-y-auto pb-4 sm:pb-0">
        {tiers.map(({ key, price, locked, owned }) => (
          <button
            key={key}
            onClick={(e) => {
              e.preventDefault()
              if (!locked && !owned && price !== null) handleSelect(key, price)
            }}
            disabled={locked || owned || price === null}
            className={`w-full px-5 py-4 sm:px-4 sm:py-3 flex items-center justify-between text-left transition-colors ${locked || owned || price === null
                ? 'opacity-40 cursor-not-allowed bg-white/[0.02]'
                : 'hover:bg-white/5'
              }`}
          >
            <div>
              <p className="text-sm sm:text-xs font-bold text-white">{LICENSE_LABELS[key]}</p>
              {locked && <p className="text-[10px] text-text-muted uppercase font-black">Sold</p>}
              {owned && <p className="text-[10px] text-accent-orange uppercase font-black">Owned</p>}
            </div>
            <span className="text-sm sm:text-xs font-black text-accent-orange flex items-center gap-1">
              {locked ? <Lock className="w-4 h-4 sm:w-3 sm:h-3" /> : owned ? <Check className="w-4 h-4 sm:w-3 sm:h-3" /> : price !== null ? convertAndFormat(price) : null}
            </span>
          </button>
        ))}
      </div>

      {ownedLicenses.length > 0 && (
        <div className="p-4 sm:p-2 border-t border-border-subtle bg-bg-elevated/50">
          <Link
            href="/library"
            className="flex items-center justify-center gap-1.5 py-3 sm:py-2 rounded-xl sm:rounded-lg text-[10px] font-black uppercase tracking-widest text-[#60a5fa] hover:bg-blue-400/10 transition-colors border border-blue-400/10 sm:border-none"
            onClick={() => setOpen(false)}
          >
            <Check className="w-3.5 h-3.5" /> View in Library
          </Link>
        </div>
      )}
    </motion.div>
  )

  if (beat.is_free) {
    const owned = isOwned('mp3')
    return (
      <button
        onClick={(e) => {
          e.preventDefault()
          if (!owned) handleSelect('mp3', 0)
        }}
        disabled={added || owned}
        className={`h-9 px-3 rounded-full font-black text-xs flex items-center justify-center transition-all flex-shrink-0 border gap-1.5 ${added ? 'bg-green-500 text-white border-green-500' :
            owned ? 'bg-bg-elevated text-text-muted border-border-subtle cursor-not-allowed' :
              'bg-accent-orange/20 hover:bg-accent-orange text-accent-orange hover:text-white border-accent-orange/30 hover:border-accent-orange'
          }`}
      >
        {added ? <><Check className="w-3.5 h-3.5" /> Added</> : owned ? 'OWNED' : 'FREE'}
      </button>
    )
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={(e) => { e.preventDefault(); setOpen(o => !o) }}
        disabled={added}
        className={`h-9 px-3 rounded-full font-black text-xs flex items-center justify-center transition-all border gap-1.5 ${added
            ? 'bg-green-500 text-white border-green-500'
            : 'bg-white/5 hover:bg-[#FF5500] text-white border-white/10 hover:border-[#FF5500]'
          }`}
      >
        {added ? (
          <><Check className="w-3.5 h-3.5" /> In Cart</>
        ) : (
          <><ShoppingCart className="w-3.5 h-3.5" /> {convertAndFormat(beat.price_mp3)}</>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {isMobile && createPortal(
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
              />,
              document.body
            )}
            
            {isMobile 
              ? createPortal(pickerContent, document.body)
              : pickerContent
            }
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

