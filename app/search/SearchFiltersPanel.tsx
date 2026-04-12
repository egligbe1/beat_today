'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, Disc3, Activity, X } from 'lucide-react'

interface Props {
  genre: string
  mood: string
  sort: string
  minBpm: string
  maxBpm: string
  query: string
  MOCK_GENRES: string[]
  MOCK_MOODS: string[]
  SORT_OPTIONS: { id: string; label: string }[]
}

function buildFilterHref(
  current: { query: string; genre: string; mood: string; sort: string; minBpm: string; maxBpm: string },
  overrides: Record<string, string>
) {
  const params = new URLSearchParams()
  if (current.query) params.set('q', current.query)
  if (current.genre && current.genre !== 'All') params.set('genre', current.genre)
  if (current.mood && current.mood !== 'All') params.set('mood', current.mood)
  if (current.sort && current.sort !== 'newest') params.set('sort', current.sort)
  if (current.minBpm) params.set('minBpm', current.minBpm)
  if (current.maxBpm) params.set('maxBpm', current.maxBpm)
  Object.entries(overrides).forEach(([key, value]) => {
    if (value && value !== 'All' && value !== 'newest') params.set(key, value)
    else params.delete(key)
  })
  return `/search?${params.toString()}`
}

export default function SearchFiltersPanel(props: Props) {
  const { genre, mood, sort, minBpm, maxBpm, query } = props
  const [open, setOpen] = useState(false)

  const href = (overrides: Record<string, string>) =>
    buildFilterHref({ query, genre, mood, sort, minBpm, maxBpm }, overrides)

  const activeFilterCount = [
    genre !== 'All' ? 1 : 0,
    mood !== 'All' ? 1 : 0,
    sort !== 'newest' ? 1 : 0,
    minBpm || maxBpm ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <>
      {/* ── Mobile: filter button ── */}
      <div className="lg:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-sm font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#FF5500]" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 bg-[#FF5500] text-white text-[10px] font-black rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile: bottom sheet ── */}
      {open && (
        <>
          <button
            className="fixed inset-0 bg-black/70 z-[110] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[111] bg-bg-surface border-t border-white/10 rounded-t-[32px] max-h-[88vh] overflow-y-auto shadow-[0_-20px_60px_rgba(0,0,0,0.9)]"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-bg-surface/95 backdrop-blur-xl z-10 rounded-t-[32px]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#FF5500]" />
                <h3 className="font-black uppercase tracking-widest text-white">Filters</h3>
              </div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <FilterBody {...props} buildFilterHref={href} onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* ── Desktop: sidebar ── */}
      <aside className="hidden lg:block w-72 flex-shrink-0 space-y-8 sticky top-28 bg-white/5 p-6 rounded-[30px] border border-white/5 self-start">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-[#FF5500]" />
          <h3 className="font-black uppercase tracking-widest text-white">Filters</h3>
        </div>
        <FilterBody {...props} buildFilterHref={href} />
      </aside>
    </>
  )
}

function FilterBody({
  genre, mood, sort, minBpm, maxBpm, query,
  buildFilterHref, MOCK_GENRES, MOCK_MOODS, SORT_OPTIONS, onClose
}: Omit<Props, 'buildFilterHref'> & { buildFilterHref: (overrides: Record<string, string>) => string; onClose?: () => void }) {
  return (
    <form action="/search" className="p-5 lg:p-0 space-y-7">
      {query && <input type="hidden" name="q" value={query} />}

      {/* Genre */}
      <div className="space-y-3">
        <label className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
          <Disc3 className="w-3.5 h-3.5" /> Genre
        </label>
        <div className="flex flex-wrap gap-2">
          {MOCK_GENRES.map((g) => (
            <Link
              key={g}
              href={buildFilterHref({ genre: g })}
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${genre === g ? 'bg-[#FF5500] text-white' : 'bg-black/20 text-text-muted hover:text-white hover:bg-white/10'}`}
            >
              {g}
            </Link>
          ))}
        </div>
      </div>

      {/* Mood */}
      <div className="space-y-3 border-t border-white/5 pt-5">
        <label className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
          <Activity className="w-3.5 h-3.5" /> Mood
        </label>
        <div className="flex flex-wrap gap-2">
          {MOCK_MOODS.map((m) => (
            <Link
              key={m}
              href={buildFilterHref({ mood: m })}
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${mood === m ? 'bg-[#FF5500] text-white' : 'bg-black/20 text-text-muted hover:text-white hover:bg-white/10'}`}
            >
              {m}
            </Link>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div className="space-y-3 border-t border-white/5 pt-5">
        <label className="text-xs font-black uppercase tracking-widest text-text-muted">Sort By</label>
        <select
          name="sort"
          defaultValue={sort}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#FF5500] focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-bg-primary text-white">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* BPM Range */}
      <div className="space-y-3 border-t border-white/5 pt-5">
        <label className="text-xs font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
          BPM Range
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="minBpm"
            defaultValue={minBpm}
            placeholder="Min"
            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-[#FF5500] focus:outline-none"
          />
          <span className="text-text-muted font-black flex-shrink-0">–</span>
          <input
            type="number"
            name="maxBpm"
            defaultValue={maxBpm}
            placeholder="Max"
            className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white focus:border-[#FF5500] focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        onClick={onClose}
        className="w-full h-12 bg-[#FF5500] hover:bg-[#FF5500]/90 text-white rounded-xl font-black uppercase tracking-widest transition-colors text-sm"
      >
        Apply Filters
      </button>
      <Link href="/search" onClick={onClose} className="block text-center text-xs font-bold text-text-muted hover:text-white">
        Reset All
      </Link>
    </form>
  )
}
