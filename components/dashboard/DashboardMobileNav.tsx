'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Music, Upload, Wallet, Settings, MessageCircle, Search } from 'lucide-react'

const PRODUCER_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/beats', label: 'Beats', icon: Music },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload },
  { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const ARTIST_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/library', label: 'Library', icon: Music },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/messages', label: 'Messages', icon: MessageCircle },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function DashboardMobileNav({ role = 'artist' }: { role?: string }) {
  const pathname = usePathname()
  const navItems = role === 'producer' ? PRODUCER_NAV : ARTIST_NAV

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[80] bg-[#0d0d0d]/95 backdrop-blur-2xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          const color = role === 'producer' ? '#FF5500' : '#60a5fa' // blue-400 for artist
          
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
            >
              <div className={`w-10 h-8 flex items-center justify-center rounded-xl transition-all ${active ? (role === 'producer' ? 'bg-[#FF5500]/15' : 'bg-blue-400/15') : ''}`}>
                <Icon className="w-5 h-5 transition-colors" style={{ color: active ? color : 'var(--text-muted)' }} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest transition-colors" style={{ color: active ? color : 'var(--text-muted)' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

