import { createPublicClient } from '@/lib/supabase/public'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import Image from 'next/image'
import { Flame, TrendingUp, Music, Play, ShoppingCart, Star, Crown } from 'lucide-react'
import BeatCard from '@/components/beats/BeatCard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Charts — BeatToday',
  description: 'Discover the hottest beats trending right now on BeatToday. Top charts by plays and sales.',
}

export const revalidate = 3600 // Revalidate every hour

// Cache the (public, non-personalized) chart data across requests for an hour.
// supabase-js issues uncached fetches, so without this every visit re-queries
// the DB; unstable_cache serves cache hits with zero DB round-trips.
const getChartsData = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // These three are independent — run them in parallel instead of in series.
    const [topByPlaysRes, recentSalesRes, risingBeatsRes] = await Promise.all([
      supabase
        .from('beats')
        .select('*, users_profiles!beats_producer_id_fkey(handle, display_name, avatar_url)')
        .eq('status', 'active')
        .order('play_count', { ascending: false })
        .limit(20),
      supabase
        .from('order_items')
        .select('beat_id, price, beats(id, title, cover_url, genre, bpm, price_mp3, play_count, producer_id, users_profiles!beats_producer_id_fkey(handle, display_name))')
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('beats')
        .select('*, users_profiles!producer_id(handle, display_name, avatar_url)')
        .eq('status', 'active')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('play_count', { ascending: false })
        .limit(8),
    ])

    return {
      topByPlays: topByPlaysRes.data,
      recentSales: recentSalesRes.data,
      risingBeats: risingBeatsRes.data,
    }
  },
  ['charts-data'],
  { revalidate: 3600, tags: ['charts'] }
)

export default async function ChartsPage() {
  const { topByPlays, recentSales, risingBeats } = await getChartsData()

  // Aggregate by beat
  const salesMap: Record<string, { beat: any; sales: number; revenue: number }> = {}
  recentSales?.forEach((item: any) => {
    const id = item.beat_id
    if (!item.beats) return
    if (!salesMap[id]) salesMap[id] = { beat: item.beats, sales: 0, revenue: 0 }
    salesMap[id].sales++
    salesMap[id].revenue += Number(item.price)
  })

  const topBySales = Object.values(salesMap)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <div className="relative overflow-hidden bg-bg-surface border-b border-border-subtle py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-gold/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <Flame className="w-8 h-8 text-accent-orange animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.4em] text-accent-orange">Live Charts</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white">Beat Charts</h1>
          <p className="text-text-muted mt-3 text-lg max-w-2xl">The hottest beats on BeatToday right now — ranked by plays, sales, and momentum.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-14 space-y-16">

        {/* Top 10 by Sales (Hot This Month) */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-orange/10 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-accent-orange" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-orange">Hot This Month</p>
              <h2 className="text-2xl font-black text-white">Best Sellers</h2>
            </div>
          </div>

          {topBySales.length > 0 ? (
            <div className="space-y-3">
              {topBySales.map(({ beat, sales, revenue }, index) => (
                <Link
                  key={beat.id}
                  href={`/beats/${beat.id}`}
                  className="flex items-center gap-4 p-4 bg-bg-surface rounded-2xl border border-border-subtle hover:border-accent-orange/30 transition-all group"
                >
                  {/* Rank */}
                  <div className={`w-10 text-center font-black text-lg flex-shrink-0 ${
                    index === 0 ? 'text-accent-gold' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-text-muted'
                  }`}>
                    {index === 0 ? <Crown className="w-6 h-6 mx-auto text-accent-gold" /> : `#${index + 1}`}
                  </div>

                  {/* Cover */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0">
                    {beat.cover_url ? (
                      <Image src={beat.cover_url} alt={beat.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <Music className="w-5 h-5 text-text-muted m-auto absolute inset-0" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate group-hover:text-accent-orange transition-colors">{beat.title}</p>
                    <p className="text-xs text-text-muted">
                      @{beat.users_profiles?.handle || 'unknown'} · {beat.genre}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-xs text-text-muted flex-shrink-0">
                    <span className="flex items-center gap-1.5 font-bold">
                      <ShoppingCart className="w-3.5 h-3.5 text-accent-orange" /> {sales} sold
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <Play className="w-3.5 h-3.5 text-accent-gold" /> {beat.play_count?.toLocaleString() || 0}
                    </span>
                    <span className="text-accent-gold font-black">${beat.price_mp3}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-text-muted">Sales data will appear here once beats start selling.</p>
          )}
        </section>

        {/* Top 20 by All-time Plays */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold">All Time</p>
              <h2 className="text-2xl font-black text-white">Most Played</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topByPlays?.map((beat: any) => (
              <BeatCard key={beat.id} beat={beat} />
            ))}
          </div>

          {(!topByPlays || topByPlays.length === 0) && (
            <p className="text-text-muted">No plays recorded yet.</p>
          )}
        </section>

        {/* Rising: New Beats with Momentum */}
        {risingBeats && risingBeats.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">New & Trending</p>
                <h2 className="text-2xl font-black text-white">Rising Beats</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {risingBeats.map((beat: any) => (
                <BeatCard key={beat.id} beat={beat} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
