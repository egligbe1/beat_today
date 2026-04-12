import { createClient } from '@/lib/supabase/server'
import BeatCard from '@/components/beats/BeatCard'
import GenreTabs from '@/components/home/GenreTabs'
import TrustRibbon from '@/components/home/TrustRibbon'
import CategoryGrid from '@/components/home/CategoryGrid'
import ValuePropSplit from '@/components/home/ValuePropSplit'
import Link from 'next/link'
import Image from 'next/image'
import { TrendingUp, Users, ArrowRight } from 'lucide-react'

const placeholderBeats = [
  { id: 'p1', title: 'STREET LEGACY', genre: 'Trap', bpm: 142, price_mp3: 29.99, cover_url: '/hero-studio.png', mp3_preview_url: '', users_profiles: { handle: 'beattoday', display_name: 'BeatToday Official' } },
  { id: 'p2', title: 'MIDNIGHT SOUL', genre: 'RnB', bpm: 95, price_mp3: 34.99, cover_url: '/genre-rnb.png', mp3_preview_url: '', users_profiles: { handle: 'beattoday', display_name: 'BeatToday Official' } },
  { id: 'p3', title: 'DRILL COMMANDER', genre: 'Drill', bpm: 140, price_mp3: 29.99, cover_url: '/genre-drill.png', mp3_preview_url: '', users_profiles: { handle: 'beattoday', display_name: 'BeatToday Official' } },
  { id: 'p4', title: 'GOLDEN ERA', genre: 'Hip Hop', bpm: 90, price_mp3: 24.99, cover_url: '/genre-hiphop.png', mp3_preview_url: '', users_profiles: { handle: 'beattoday', display_name: 'BeatToday Official' } },
]

export const revalidate = 120

export default async function Home({ searchParams }: { searchParams: { genre?: string; q?: string } }) {
  const supabase = createClient()
  const genreStr = searchParams.genre

  const beatsQuery = supabase
    .from('beats')
    .select('*, users_profiles!inner(handle, display_name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(8)

  const proProducersQuery = supabase
    .from('users_profiles')
    .select('*, producer_settings!inner(subscription_tier)')
    .eq('role', 'producer')
    .eq('producer_settings.subscription_tier', 'pro')
    .limit(6)

  const starterProducersQuery = supabase
    .from('users_profiles')
    .select('*, producer_settings!inner(subscription_tier)')
    .eq('role', 'producer')
    .eq('producer_settings.subscription_tier', 'starter')
    .limit(6)

  if (genreStr && genreStr !== 'All') beatsQuery.eq('genre', genreStr)

  const [{ data: beats }, { data: proProducers }, { data: starterProducers }] = await Promise.all([
    beatsQuery, proProducersQuery, starterProducersQuery,
  ])

  const producers = (proProducers && proProducers.length > 0) ? proProducers : (starterProducers || [])

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative h-[420px] sm:h-[520px] md:h-[620px] flex items-end justify-center overflow-hidden">
        <Image src="/hero-studio.png" alt="Studio" fill priority className="object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent" />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-10 sm:pb-16 text-center">
          {/* Pill */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-[#FF5500] mb-5 sm:mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-pulse" />
            World-Class Beats
          </div>

          {/* Heading */}
          <h1 className="text-[2.6rem] leading-[1] sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-4 sm:mb-5">
            Your First Hit<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FFB000]">Starts Here.</span>
          </h1>

          <p className="text-text-muted text-sm sm:text-base max-w-md mx-auto mb-6 sm:mb-8 leading-relaxed">
            License premium beats from Africa&apos;s top producers. Instant delivery. Full ownership.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link href="/search" className="flex items-center justify-center h-12 sm:h-14 px-7 sm:px-10 bg-[#FF5500] text-white rounded-full font-black text-sm sm:text-base uppercase tracking-wide hover:bg-[#FF5500]/90 active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,85,0,0.4)]">
              Explore Beats
            </Link>
            <Link href="/signup?role=producer" className="flex items-center justify-center h-12 sm:h-14 px-7 sm:px-10 bg-white/8 border border-white/15 text-white rounded-full font-black text-sm sm:text-base uppercase tracking-wide hover:bg-white/15 active:scale-95 transition-all">
              Sell Your Beats
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust Ribbon ───────────────────────────── */}
      <TrustRibbon />

      {/* ── Main Content ───────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16 sm:space-y-28">

        {/* Browse by genre */}
        <CategoryGrid />

        {/* New & Notable */}
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
            {beats && beats.length > 0
              ? beats.map((beat: any) => <BeatCard key={beat.id} beat={beat} />)
              : placeholderBeats.map((beat) => <BeatCard key={beat.id} beat={beat as any} />)
            }
          </div>
        </section>

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
                      {producer.producer_settings?.subscription_tier === 'pro' ? '⭐ PRO' : 'Featured'}
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
