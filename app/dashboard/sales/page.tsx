import { getCachedAuthContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, Music, TrendingUp, BarChart2, ShoppingCart, Play, Lock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { getTierLimits } from '@/lib/tierLimits'

export default async function SalesPage() {
  const { user, profile } = await getCachedAuthContext()
  if (!user) redirect('/login')
  if (profile?.role !== 'producer') redirect('/dashboard/unauthorized')

  const supabase = createClient()

  const { data: settings } = await supabase
    .from('producer_settings')
    .select('subscription_tier')
    .eq('user_id', user.id)
    .single()

  const tier = (settings?.subscription_tier || 'free').toLowerCase()
  const isStarter = tier === 'starter' || tier === 'pro'

  const { data: sales } = await supabase
    .from('order_items')
    .select(`
      id, price, license_type, created_at,
      orders!inner(id, buyer_profiles:users_profiles!buyer_id(display_name, handle)),
      beats(id, cover_url, title, play_count)
    `)
    .eq('producer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: allBeats } = await supabase
    .from('beats')
    .select('id, title, play_count, status')
    .eq('producer_id', user.id)

  const totalSales = sales?.reduce((sum, item) => sum + Number(item.price), 0) || 0
  const totalPlays = allBeats?.reduce((sum, b) => sum + (b.play_count || 0), 0) || 0
  const activeBeats = allBeats?.filter(b => b.status === 'active').length || 0
  const conversionRate = totalPlays > 0
    ? ((sales?.length || 0) / totalPlays * 100).toFixed(2)
    : '0.00'

  // Sales by license type
  const licenseBreakdown = sales?.reduce((acc: Record<string, { count: number; revenue: number }>, item: any) => {
    const type = item.license_type
    if (!acc[type]) acc[type] = { count: 0, revenue: 0 }
    acc[type].count++
    acc[type].revenue += Number(item.price)
    return acc
  }, {}) || {}

  // Sales per day for the last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentSalesByDay = sales
    ?.filter(s => new Date(s.created_at) >= thirtyDaysAgo)
    .reduce((acc: Record<string, number>, item: any) => {
      const day = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      acc[day] = (acc[day] || 0) + Number(item.price)
      return acc
    }, {}) || {}

  // Generate last 14 days labels
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const dailyRevenue = last14Days.map(day => ({
    label: day,
    value: recentSalesByDay[day] || 0
  }))

  const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.value), 1)

  // Top beats by revenue
  const beatReports = sales?.reduce((acc: Record<string, any>, item: any) => {
    const beatId = item.beats?.id || item.id
    const title = item.beats?.title || 'Untitled Beat'
    const coverUrl = item.beats?.cover_url
    const playCount = item.beats?.play_count || 0
    if (!acc[beatId]) acc[beatId] = { title, coverUrl, revenue: 0, count: 0, playCount }
    acc[beatId].revenue += Number(item.price)
    acc[beatId].count += 1
    return acc
  }, {})

  const topBeats = Object.values(beatReports || {}).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
  const maxRevenue = topBeats[0]?.revenue || 1

  const recentSales = sales?.slice(0, 20)

  const LICENSE_COLORS: Record<string, string> = {
    mp3: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    wav: 'text-accent-gold bg-accent-gold/10 border-accent-gold/20',
    trackout: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    exclusive: 'text-accent-orange bg-accent-orange/10 border-accent-orange/20',
  }

  if (!isStarter) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 bg-accent-orange/10 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-accent-orange" />
        </div>
        <h1 className="text-3xl font-black text-white">Sales Analytics</h1>
        <p className="text-text-muted">
          The full sales dashboard — revenue charts, license breakdown, conversion rates, and top beat reports — is available on <strong className="text-accent-gold">STARTER</strong> and above.
        </p>
        <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-3 text-left">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">Unlock with STARTER</p>
          {['14-day revenue chart', 'Revenue by license type', 'Top performing beats', 'Play-to-purchase conversion rate', 'Full recent sales table'].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange/50" />
              {f}
            </div>
          ))}
        </div>
        <Link href="/dashboard/subscription" className="inline-flex h-12 px-8 bg-accent-orange text-white font-black rounded-2xl items-center justify-center hover:bg-accent-orange/90 transition-colors">
          Upgrade to STARTER — $9.99/yr
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight mb-2">Sales & Analytics</h1>
        <p className="text-text-muted text-sm sm:text-base">Track your beat sales, revenue trends, and performance data.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'Lifetime Revenue', value: formatCurrency(totalSales), color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
          { icon: ShoppingCart, label: 'Total Sales', value: String(sales?.length || 0), color: 'text-accent-green', bg: 'bg-accent-green/10' },
          { icon: Play, label: 'Total Plays', value: totalPlays.toLocaleString(), color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
          { icon: TrendingUp, label: 'Play→Purchase', value: `${conversionRate}%`, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-bg-surface p-6 rounded-3xl border border-border-subtle shadow-xl">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-1">{label}</p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart (14-day bar chart) */}
      <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <BarChart2 className="w-5 h-5 text-accent-orange" />
          <h2 className="text-lg font-black text-white">Revenue — Last 14 Days</h2>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {dailyRevenue.map(({ label, value }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex items-end justify-center" style={{ height: '100px' }}>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-accent-orange/40 to-accent-orange/80 transition-all group-hover:from-accent-orange/60 group-hover:to-accent-orange"
                  style={{ height: `${Math.max(2, (value / maxDailyRevenue) * 100)}%` }}
                />
                {value > 0 && (
                  <div className="absolute bottom-full mb-1 bg-bg-elevated text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {formatCurrency(value)}
                  </div>
                )}
              </div>
              <p className="text-[8px] text-text-muted font-bold text-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '28px' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* License Breakdown */}
        <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl">
          <h2 className="text-base sm:text-lg font-black text-white mb-4 sm:mb-6">Revenue by License</h2>
          <div className="space-y-4">
            {Object.entries(licenseBreakdown).length > 0 ? (
              Object.entries(licenseBreakdown)
                .sort(([, a]: any, [, b]: any) => b.revenue - a.revenue)
                .map(([type, data]: any) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${LICENSE_COLORS[type] || 'text-text-muted bg-white/5 border-white/10'}`}>
                        {type} × {data.count}
                      </span>
                      <span className="text-sm font-bold text-white">{formatCurrency(data.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-orange to-accent-gold"
                        style={{ width: `${Math.max(4, (data.revenue / totalSales) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-text-muted text-sm">No sales yet.</p>
            )}
          </div>
        </div>

        {/* Top Performing Beats */}
        <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-border-subtle shadow-xl">
          <h2 className="text-base sm:text-lg font-black text-white mb-4 sm:mb-6">Top Performing Beats</h2>
          <div className="space-y-4">
            {topBeats.length > 0 ? (
              topBeats.map((beat: any, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-black text-text-muted w-4">#{index + 1}</span>
                  <div className="w-9 h-9 rounded-lg bg-bg-elevated overflow-hidden relative flex-shrink-0">
                    {beat.coverUrl ? (
                      <Image src={beat.coverUrl} alt="" fill className="object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-text-muted m-auto absolute inset-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{beat.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-orange to-accent-gold rounded-full"
                          style={{ width: `${Math.max(8, (beat.revenue / maxRevenue) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-accent-gold font-bold flex-shrink-0">{formatCurrency(beat.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-text-muted text-sm">Make your first sale to see analytics here.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales Table */}
      <div>
        <h2 className="text-xl font-bold mb-4">Recent Sales</h2>
        <div className="bg-bg-surface rounded-3xl border border-border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-elevated/50 text-text-muted uppercase tracking-widest text-[10px] font-bold">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4">Beat</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Buyer</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4">License</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">Date</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentSales && recentSales.length > 0 ? (
                  recentSales.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-bg-elevated/30 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-bg-elevated overflow-hidden relative flex-shrink-0">
                            {sale.beats?.cover_url ? (
                              <Image src={sale.beats.cover_url} alt="" fill className="object-cover" />
                            ) : (
                              <Music className="w-4 h-4 text-text-muted m-auto absolute inset-0" />
                            )}
                          </div>
                          <span className="font-bold truncate max-w-[100px] sm:max-w-[140px] text-xs sm:text-sm">{sale.beats?.title || 'Unknown Beat'}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-xs sm:text-sm hidden sm:table-cell">
                        {sale.orders?.buyer_profiles?.display_name || 'Guest'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-1.5 sm:px-2 py-1 rounded-full border ${LICENSE_COLORS[sale.license_type] || ''}`}>
                          {sale.license_type}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-text-muted text-xs sm:text-sm hidden sm:table-cell whitespace-nowrap">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right font-bold text-accent-gold text-xs sm:text-sm whitespace-nowrap">
                        {formatCurrency(sale.price)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 sm:py-20 text-center text-text-muted">No sales yet. Keep grinding!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
