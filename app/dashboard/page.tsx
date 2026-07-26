import { getCachedAuthContext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { Activity, DollarSign, Music, Users, ShoppingCart, Play, TrendingUp, Bell, FolderOpen, MessageCircle, Heart } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import WalletSnippet from './WalletSnippet'

export default async function DashboardOverview() {
  const { user, profile, error: authError } = await getCachedAuthContext()
  if (authError || !user) redirect('/login')
  if (!profile) redirect('/complete-profile')

  const supabase = createClient()
  const isProducer = profile.role === 'producer'

  // Fetch role-specific data
  let dashboardData: any = {}

  if (isProducer) {
    const [settingsResult, beatsCountResult, followersCountResult, recentSalesResult, walletResult, notificationsResult] = await Promise.all([
      supabase.from('producer_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('beats').select('id', { count: 'exact', head: true }).eq('producer_id', user.id).eq('status', 'active'),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('order_items')
        .select('id, price, license_type, created_at, beats(title, cover_url), orders!inner(buyer_profiles:users_profiles!buyer_id(display_name))')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('wallets').select('available_balance, pending_balance').eq('producer_id', user.id).single(),
      supabase.from('notifications').select('id').eq('user_id', user.id).eq('is_read', false),
    ])

    dashboardData = {
      settings: settingsResult.data,
      beatsCount: beatsCountResult.count || 0,
      followersCount: followersCountResult.count || 0,
      recentSales: recentSalesResult.data || [],
      wallet: walletResult.data,
      unreadCount: notificationsResult.data?.length || 0,
      totalRevenue: (walletResult.data?.available_balance || 0) + (walletResult.data?.pending_balance || 0)
    }
  } else {
    // Artist Data
    const [purchasesResult, favoritesResult, followingResult, notificationsResult] = await Promise.all([
      supabase.from('orders')
        .select('*, order_items(*, beats(*))')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('favorites').select('beat_id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('notifications').select('id').eq('user_id', user.id).eq('is_read', false),
    ])

    dashboardData = {
      recentPurchases: purchasesResult.data || [],
      favoritesCount: favoritesResult.count || 0,
      followingCount: followingResult.count || 0,
      unreadCount: notificationsResult.data?.length || 0,
      totalOrders: purchasesResult.data?.length || 0
    }
  }

  const quickLinks = isProducer ? [
    { href: '/dashboard/upload', label: 'Upload Beat', icon: Music, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
    { href: '/dashboard/sales', label: 'View Sales', icon: ShoppingCart, color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
    { href: '/dashboard/subscription', label: 'Upgrade Plan', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { href: '/dashboard/promo-codes', label: 'Promo Codes', icon: Activity, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ] : [
    { href: '/search', label: 'Browse Beats', icon: Music, color: 'text-accent-orange', bg: 'bg-accent-orange/10' },
    { href: '/library', label: 'My Library', icon: FolderOpen, color: 'text-accent-gold', bg: 'bg-accent-gold/10' },
    { href: '/dashboard/favorites', label: 'Favorites', icon: Heart, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { href: '/dashboard/settings', label: 'Update Profile', icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ]


  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight mb-2">
            Welcome back, {profile?.display_name || 'Friend'}
          </h1>
          <p className="text-text-muted">
            {isProducer ? "Here's what's happening with your store today." : "Manage your library and track your favorite sounds."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dashboardData.unreadCount > 0 && (
            <Link href="/messages" className="h-12 px-4 rounded-xl bg-bg-surface border border-border-subtle text-text-muted hover:text-white flex items-center gap-2 text-sm font-bold transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-accent-orange text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {dashboardData.unreadCount}
              </span>
            </Link>
          )}
          {isProducer && (
            <Link href="/dashboard/upload" className="h-12 px-6 bg-accent-orange text-white rounded-xl font-bold flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-accent-orange/20">
              Upload New Beat
            </Link>
          )}
        </div>
      </div>

      {isProducer ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-accent-gold transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-accent-gold" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Revenue</p>
            <p className="text-xl sm:text-2xl font-black">{formatCurrency(dashboardData.totalRevenue)}</p>
          </div>
          <div className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-accent-orange transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-orange/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-accent-orange" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Plays</p>
            <p className="text-xl sm:text-2xl font-black">{(dashboardData.settings?.total_plays || 0).toLocaleString()}</p>
          </div>
          <div className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-white transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bg-elevated rounded-xl flex items-center justify-center mb-2 sm:mb-3">
              <Music className="w-4 h-4 sm:w-5 sm:h-5 text-text-primary" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Beats</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.beatsCount}</p>
          </div>
          <div className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-blue-500 transition-colors">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Followers</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.followersCount}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/library" className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-accent-orange transition-colors group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-orange/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-orange" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Purchases</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.totalOrders}</p>
          </Link>
          <Link href="/dashboard/favorites" className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-accent-gold transition-colors group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-gold" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Favorites</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.favoritesCount}</p>
          </Link>
          <Link href="/dashboard/following" className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-blue-500 transition-colors group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Following</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.followingCount}</p>
          </Link>
          <Link href="/messages" className="bg-bg-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-border-subtle hover:border-white transition-colors group">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bg-elevated rounded-xl flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-text-primary" />
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mb-1">Unread</p>
            <p className="text-xl sm:text-2xl font-black">{dashboardData.unreadCount}</p>
          </Link>

        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-bg-surface rounded-2xl sm:rounded-3xl border border-border-subtle overflow-hidden">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border-subtle">
            <h2 className="font-black text-white uppercase tracking-widest text-sm">
              {isProducer ? 'Recent Sales' : 'Recent Purchases'}
            </h2>
            <Link href={isProducer ? "/dashboard/sales" : "/library"} className="text-xs text-accent-orange font-bold hover:underline uppercase tracking-widest">View All</Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {isProducer ? (
              dashboardData.recentSales.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-text-muted">
                  <Activity className="w-10 h-10 opacity-30 mx-auto mb-3" />
                  <p className="font-bold text-sm">No sales yet. Keep going!</p>
                </div>
              ) : (
                dashboardData.recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0">
                      {sale.beats?.cover_url ? (
                        <Image src={sale.beats.cover_url} alt="" fill className="object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-text-muted m-auto absolute inset-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{sale.beats?.title}</p>
                      <p className="text-[10px] sm:text-xs text-text-muted truncate">
                        {sale.orders?.buyer_profiles?.display_name || 'Guest'} · {sale.license_type}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-black text-accent-gold">{formatCurrency(sale.price)}</p>
                      <p className="text-[9px] sm:text-[10px] text-text-muted whitespace-nowrap">{new Date(sale.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )
            ) : (
              dashboardData.recentPurchases.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-text-muted">
                  <ShoppingCart className="w-10 h-10 opacity-30 mx-auto mb-3" />
                  <p className="font-bold text-sm">No purchases yet. Start browsing!</p>
                </div>
              ) : (
                dashboardData.recentPurchases.map((order: any) => (
                  <Link key={order.id} href={`/library/${order.id}`} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0">
                      {order.order_items?.[0]?.beats?.cover_url ? (
                        <Image src={order.order_items[0].beats.cover_url} alt="" fill className="object-cover" />
                      ) : (
                        <Music className="w-4 h-4 text-text-muted m-auto absolute inset-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {order.order_items?.[0]?.beats?.title || 'Order ' + order.gateway_reference}
                        {order.order_items?.length > 1 && ` (+${order.order_items.length - 1} more)`}
                      </p>
                      <p className="text-[10px] sm:text-xs text-text-muted truncate capitalize">Status: {order.status}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-black text-accent-gold">{formatCurrency(order.total_amount)}</p>
                      <p className="text-[9px] sm:text-[10px] text-text-muted whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          {isProducer && dashboardData.wallet && (
            <WalletSnippet
              available={dashboardData.wallet.available_balance || 0}
              pending={dashboardData.wallet.pending_balance || 0}
            />
          )}

          <div className="bg-bg-surface rounded-2xl sm:rounded-3xl border border-border-subtle p-4 sm:p-5 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-text-muted mb-3">Quick Actions</h3>
            {quickLinks.map(({ href, label, icon: Icon, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-sm font-bold text-text-muted group-hover:text-white transition-colors">{label}</span>
              </Link>

            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
