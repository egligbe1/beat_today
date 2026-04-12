import { createClient } from '@/lib/supabase/server'
import BeatCard from '@/components/beats/BeatCard'
import Link from 'next/link'
import { Search as SearchIcon, Music } from 'lucide-react'
import SearchFiltersPanel from './SearchFiltersPanel'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; genre?: string; minBpm?: string; maxBpm?: string; mood?: string; sort?: string }
}) {
  const supabase = createClient()
  const query = searchParams.q || ''
  const genre = searchParams.genre || 'All'
  const sort = searchParams.sort || 'newest'
  const rawMin = searchParams.minBpm
  const rawMax = searchParams.maxBpm
  const minBpm = rawMin && !isNaN(parseInt(rawMin)) ? parseInt(rawMin) : 0
  const maxBpm = rawMax && !isNaN(parseInt(rawMax)) ? parseInt(rawMax) : 250
  const mood = searchParams.mood || 'All'

  let beatsQuery = supabase
    .from('search_catalog')
    .select('*')

  if (query) {
    // Search across title, producer handle, producer display name, genre, and mood
    beatsQuery = beatsQuery.or(
      `title.ilike.%${query}%,producer_handle.ilike.%${query}%,producer_display_name.ilike.%${query}%,genre.ilike.%${query}%,mood_tags.cs.{${query}}`
    )
  }

  if (genre !== 'All') beatsQuery = beatsQuery.eq('genre', genre)
  if (mood !== 'All') beatsQuery = beatsQuery.contains('mood_tags', [mood])
  if (minBpm > 0) beatsQuery = beatsQuery.gte('bpm', minBpm)
  if (maxBpm < 250) beatsQuery = beatsQuery.lte('bpm', maxBpm)

  switch (sort) {
    case 'price_asc': beatsQuery = beatsQuery.order('price_mp3', { ascending: true }); break
    case 'price_desc': beatsQuery = beatsQuery.order('price_mp3', { ascending: false }); break
    case 'popularity': beatsQuery = beatsQuery.order('play_count', { ascending: false }); break
    default: beatsQuery = beatsQuery.order('created_at', { ascending: false }); break
  }

  const { data: rawData, error } = await beatsQuery
  if (error) console.error('Supabase Search Error:', error)

  // Map view results to the nested structure BeatCard expects
  const rawBeats = rawData?.map((item: any) => ({
    ...item,
    users_profiles: {
      handle: item.producer_handle,
      display_name: item.producer_display_name
    }
  }))

  const TIER_WEIGHT: Record<string, number> = { pro: 2, starter: 1, free: 0 }
  const beats = (rawBeats && sort === 'newest')
    ? [...rawBeats].sort((a: any, b: any) => {
        const aTier = (a.subscription_tier || 'free').toLowerCase()
        const bTier = (b.subscription_tier || 'free').toLowerCase()
        const weightDiff = (TIER_WEIGHT[bTier] ?? 0) - (TIER_WEIGHT[aTier] ?? 0)
        if (weightDiff !== 0) return weightDiff
        return new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
      })
    : rawBeats

  const MOCK_MOODS = ['All', 'Dark', 'Chill', 'Energetic', 'Sad', 'Aggressive']
  const MOCK_GENRES = ['All', 'Afrobeats', 'Amapiano', 'Highlife', 'Afro-drill', 'Pop']
  const SORT_OPTIONS = [
    { id: 'newest', label: 'Newest' },
    { id: 'price_asc', label: 'Lowest Price' },
    { id: 'price_desc', label: 'Highest Price' },
    { id: 'popularity', label: 'Most Popular' },
  ]

  const buildFilterHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (genre && genre !== 'All') params.set('genre', genre)
    if (mood && mood !== 'All') params.set('mood', mood)
    if (sort) params.set('sort', sort)
    if (minBpm > 0) params.set('minBpm', String(minBpm))
    if (maxBpm < 250) params.set('maxBpm', String(maxBpm))
    Object.entries(overrides).forEach(([key, value]) => {
      if (value && value !== 'All') params.set(key, value)
      else params.delete(key)
    })
    return `/search?${params.toString()}`
  }

  return (
    <div className="min-h-screen bg-bg-primary pt-24 pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

        {/* Page Header */}
        <div className="mb-6 sm:mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none mb-2">
            The <span className="text-[#FF5500]">Lab.</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base font-medium">Filter by BPM, Mood, or Genre to lock in your exact sound.</p>
        </div>

        {/* Search bar */}
        <form action="/search" className="relative mb-6 group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-[#FF5500] transition-colors" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by title, producer, genre..."
            className="w-full h-12 sm:h-14 bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 text-white text-sm font-medium placeholder:text-text-muted/50 focus:outline-none focus:border-[#FF5500] transition-all"
          />
        </form>

        {/* Active filter pills — mobile only */}
        {(genre !== 'All' || mood !== 'All' || sort !== 'newest') && (
          <div className="lg:hidden flex flex-wrap gap-2 mb-4">
            {genre !== 'All' && (
              <Link href={buildFilterHref({ genre: 'All' })} className="flex items-center gap-1 px-3 py-1.5 bg-[#FF5500]/10 border border-[#FF5500]/20 text-[#FF5500] text-xs font-bold rounded-full">
                {genre} ×
              </Link>
            )}
            {mood !== 'All' && (
              <Link href={buildFilterHref({ mood: 'All' })} className="flex items-center gap-1 px-3 py-1.5 bg-[#FF5500]/10 border border-[#FF5500]/20 text-[#FF5500] text-xs font-bold rounded-full">
                {mood} ×
              </Link>
            )}
            {sort !== 'newest' && (
              <Link href={buildFilterHref({ sort: 'newest' })} className="flex items-center gap-1 px-3 py-1.5 bg-white/5 border border-white/10 text-text-muted text-xs font-bold rounded-full">
                {SORT_OPTIONS.find(s => s.id === sort)?.label} ×
              </Link>
            )}
            <Link href="/search" className="px-3 py-1.5 text-xs font-bold text-text-muted hover:text-white">Clear all</Link>
          </div>
        )}

        {/* Filters + Results */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-start">
          {/* SearchFiltersPanel: shows mobile trigger+sheet + desktop sidebar */}
          <SearchFiltersPanel
            genre={genre}
            mood={mood}
            sort={sort}
            minBpm={rawMin || ''}
            maxBpm={rawMax || ''}
            query={query}
            MOCK_GENRES={MOCK_GENRES}
            MOCK_MOODS={MOCK_MOODS}
            SORT_OPTIONS={SORT_OPTIONS}
          />

          {/* Results */}
          <main className="flex-1 w-full min-w-0">
            {beats && beats.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-xs font-black uppercase tracking-widest text-text-muted">
                    {beats.length} beat{beats.length !== 1 ? 's' : ''}
                    {query && <span> for &ldquo;{query}&rdquo;</span>}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {beats.map((beat: any, index: number) => (
                    <BeatCard key={beat.id} beat={beat} priority={index < 4} />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-16 sm:py-28 bg-white/5 rounded-[28px] sm:rounded-[40px] border border-dashed border-white/10 flex flex-col items-center justify-center space-y-5 px-6">
                <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center">
                  <Music className="w-9 h-9 text-[#FF5500]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">No beats found</h3>
                  <p className="text-text-muted max-w-sm mx-auto font-medium text-sm">Try a different genre, mood, or BPM range.</p>
                </div>
                <Link href="/search" className="h-12 px-8 bg-white/10 text-white rounded-full font-bold uppercase tracking-widest flex items-center justify-center hover:bg-white/20 transition-all">
                  Clear Filters
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
