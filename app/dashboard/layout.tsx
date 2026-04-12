import Link from 'next/link'
import { LayoutDashboard, Upload, DollarSign, Settings, FileText, Music, Wallet, Tag, FolderOpen, Crown, MessageCircle } from 'lucide-react'
import DashboardMobileNav from '@/components/dashboard/DashboardMobileNav'

const PRODUCER_NAV = [
  {
    label: 'Store',
    links: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/beats', label: 'My Beats', icon: Music },
      { href: '/dashboard/upload', label: 'Upload Beat', icon: Upload },
      { href: '/dashboard/collections', label: 'Albums', icon: FolderOpen },
    ]
  },
  {
    label: 'Revenue',
    links: [
      { href: '/dashboard/sales', label: 'Sales & Analytics', icon: DollarSign },
      { href: '/dashboard/wallet', label: 'Wallet & Payouts', icon: Wallet },
      { href: '/dashboard/promo-codes', label: 'Promo Codes', icon: Tag },
    ]
  },
  {
    label: 'Account',
    links: [
      { href: '/dashboard/licenses', label: 'Licenses', icon: FileText },
      { href: '/dashboard/subscription', label: 'Subscription', icon: Crown },
      { href: '/messages', label: 'Messages', icon: MessageCircle },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ]
  },
]

const ARTIST_NAV = [
  {
    label: 'Library',
    links: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/library', label: 'My Purchases', icon: FolderOpen },
      { href: '/dashboard/favorites', label: 'Favorites', icon: Music },
    ]
  },
  {
    label: 'Engagement',
    links: [
      { href: '/messages', label: 'Messages', icon: MessageCircle },
    ]
  },
  {
    label: 'Account',
    links: [
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ]
  },
]

import { getCachedAuthContext } from '@/lib/auth'
import { redirect } from 'next/navigation'

import { AuthProvider } from '@/components/providers/AuthProvider'

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, profile } = await getCachedAuthContext()

  if (!user) {
    redirect('/login?redirect=/dashboard')
  }

  if (!profile) {
    redirect('/complete-profile')
  }

  const isProducer = profile.role === 'producer'
  const navGroups = isProducer ? PRODUCER_NAV : ARTIST_NAV

  return (
    <AuthProvider initialUser={user} initialProfile={profile}>
      <div className="min-h-[calc(100vh-80px)] bg-bg-primary flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-bg-surface border-r border-border-subtle p-6 hidden md:flex flex-col gap-8 flex-shrink-0">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted">
            {isProducer ? 'Producer Hub' : 'Artist Hub'}
          </h2>
          <nav className="space-y-6 flex-1">
            {navGroups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-text-muted/50 mb-2 px-3">{group.label}</p>
                <div className="space-y-0.5">
                  {group.links.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 font-bold text-text-muted hover:text-white hover:bg-bg-elevated p-3 rounded-xl transition-all text-sm"
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="p-4 md:p-8 pb-28 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <DashboardMobileNav role={profile.role} />
      </div>
    </AuthProvider>
  )
}
