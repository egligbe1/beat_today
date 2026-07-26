import { createPublicClient } from '@/lib/supabase/public'
import { unstable_cache } from 'next/cache'
import BeatCard from '@/components/beats/BeatCard'
import GenreTabs from '@/components/home/GenreTabs'
import TrustRibbon from '@/components/home/TrustRibbon'
import CategoryGrid from '@/components/home/CategoryGrid'
import ValuePropSplit from '@/components/home/ValuePropSplit'
import Link from 'next/link'
import Image from 'next/image'
import { TrendingUp, Users, ArrowRight, Music } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BeatToday — Buy Beats & License Instrumentals',
  description: 'Discover, stream, and license beats from independent producers worldwide. Instant delivery, clear licensing, and secure checkout.',
  openGraph: {
    title: 'BeatToday — Buy Beats & License Instrumentals',
    description: 'Discover, stream, and license beats from independent producers worldwide.',
  },
}

const HeroCarousel = dynamic(() => import('@/components/home/HeroCarousel'), { 
  loading: () => <div className="w-full h-[300px] sm:h-[500px] bg-zinc-950 animate-pulse" />
})

export const revalidate = 120

// Cache the (public, non-personalized) homepage data per genre so a fresh visit
// doesn't block on live DB queries before any HTML — including the hero — is
// sent. Cache hits serve with zero DB round-trips.
const getHomeData = (genre?: string) => unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const beatsQuery = supabase
      .from('beats')
      .select('*, users_profiles!beats_producer_id_fkey!inner(handle, display_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)
    if (genre && genre !== 'All') beatsQuery.eq('genre', genre)

    const [{ data: beats }, { data: proProducers }, { data: starterProducers }] = await Promise.all([
      beatsQuery,
      supabase.from('users_profiles').select('*, producer_settings!inner(subscription_tier)').eq('role', 'producer').eq('producer_settings.subscription_tier', 'PRO').limit(6),
      supabase.from('users_profiles').select('*, producer_settings!inner(subscription_tier)').eq('role', 'producer').eq('producer_settings.subscription_tier', 'STARTER').limit(6),
    ])
    return { beats: beats || [], proProducers: proProducers || [], starterProducers: starterProducers || [] }
  },
  ['home-data', genre || 'all'],
  { revalidate: 120, tags: ['home'] }
)()

export default async function Home({ searchParams }: { searchParams: { genre?: string; q?: string } }) {
  const { beats, proProducers, starterProducers } = await getHomeData(searchParams.genre)
  const producers = (proProducers && proProducers.length > 0) ? proProducers : (starterProducers || [])

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Hero Carousel ───────────────────────────── */}
      <HeroCarousel tracks={beats || []} />

      {/* ── Trust Ribbon ───────────────────────────── */}
      <TrustRibbon />

      {/* ── Main Content ───────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16 sm:space-y-28">

        {/* Browse by genre */}
        <CategoryGrid />

        {/* New & Notable */}
        {beats && beats.length > 0 ? (
          <section>
            <div className="flex items-end justify-between mb-5 sm:mb-8 pb-5 border-b border-white/5">
              <div className="space-y-2 sm:space-y-3 min-w-0 flex-1 pr-4">
                <div className="inline-flex items-center gap-1.5 text-[#FF5500] font-black uppercase tracking-widest text-[10px] bg-[#FF5500]/10 px-3 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" /> Trending
                </div>
                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">New &amp; Notable</h2>
                <div className="mt-2">
                  <GenreTabs />
                </div>
              </div>
              <Link href="/search" className="flex-shrink-0 h-10 px-5 bg-white/5 hover:bg-white/10 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all group border border-white/10">
                All <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {beats.map((beat: any, i: number) => (
                <BeatCard 
                  key={beat.id} 
                  beat={beat} 
                  priority={i < 4} 
                />
              ))}
            </div>
          </section>
        ) : (
          <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <Music className="w-12 h-12 text-[#FF5500] mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2">No beats available yet</h3>
            <p className="text-text-muted text-sm font-medium">Coming soon. Professional tracks are being prepared.</p>
          </div>
        )}

        {/* For Artists / For Producers */}
        <ValuePropSplit />

        {/* Featured Producers */}
        {producers && producers.length > 0 && (
          <section className="bg-white/[0.03] rounded-3xl border border-white/5 px-4 sm:px-8 py-10 sm:py-16 text-center overflow-hidden relative">
            <div className="absolute -top-20 right-0 w-64 h-64 bg-[#FFB000]/10 blur-[80px] rounded-full pointer-events-none" />

            <div className="mb-8 sm:mb-12 relative z-10">
              <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter mb-2">
                Featured <span className="text-[#FFB000]">Producers</span>
              </h2>
              <p className="text-text-muted text-sm max-w-sm mx-auto">Connect with verified creators building the sound of Africa.</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 relative z-10">
              {producers.map((producer) => (
                <Link
                  key={producer.id}
                  href={`/@${producer.handle}`}
                  className="group flex flex-col items-center gap-3"
                >
                  <div className="relative w-16 h-16 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-bg-elevated border-2 border-white/10 group-hover:border-[#FFB000] transition-colors shadow-xl">
                    {producer.avatar_url ? (
                      <Image src={producer.avatar_url} alt={producer.display_name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-text-muted" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-black text-white group-hover:text-[#FFB000] transition-colors text-xs sm:text-sm uppercase tracking-tight truncate max-w-[80px] sm:max-w-[120px]">{producer.display_name}</p>
                    <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#FF5500] mt-0.5">
                      {(producer.producer_settings?.subscription_tier || '').toUpperCase() === 'PRO' ? '⭐ PRO' : 'Featured'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
