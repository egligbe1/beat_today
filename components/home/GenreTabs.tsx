'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const GENRES = [
  'All', 'Afrobeats', 'Amapiano', 'Afro-drill', 'Trap Dancehall', 'Dancehall',
  'Gengetone', 'Bongo Flava', 'Highlife', 'Afrosoul', 'Afro-R&B', 'Hip-Hop', 'Global'
]

function GenreTabsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeGenre = searchParams.get('genre') || 'All'

  const handleGenreChange = (genre: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (genre === 'All') params.delete('genre')
    else params.set('genre', genre)
    router.push(`/?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
      {GENRES.map((genre) => (
        <button
          key={genre}
          onClick={() => handleGenreChange(genre)}
          className={cn(
            'px-3 sm:px-4 py-1.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-bold transition-all border flex-shrink-0',
            activeGenre === genre
              ? 'bg-accent-orange border-accent-orange text-white shadow-lg shadow-accent-orange/20'
              : 'bg-bg-surface border-border-subtle text-text-muted hover:border-white/30 hover:text-white'
          )}
        >
          {genre}
        </button>
      ))}
    </div>
  )
}

export default function GenreTabs() {
  return (
    <Suspense fallback={<div className="h-8 w-full animate-pulse bg-bg-surface rounded-full" />}>
      <GenreTabsContent />
    </Suspense>
  )
}
