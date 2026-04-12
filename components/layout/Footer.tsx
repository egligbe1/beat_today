import Link from 'next/link'
import { Music, Instagram, Twitter, Youtube, Mail, MapPin } from 'lucide-react'

const SOCIAL_LINKS = [
  { href: 'https://instagram.com/beattoday', label: 'Instagram', Icon: Instagram },
  { href: 'https://twitter.com/beattoday', label: 'Twitter / X', Icon: Twitter },
  { href: 'https://youtube.com/@beattoday', label: 'YouTube', Icon: Youtube },
]

import { createClient } from '@/lib/supabase/server'

export default async function Footer() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let role = null

  if (user) {
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = profile?.role
  }

  return (
    <footer className="bg-black border-t border-white/5 pt-16 pb-10 px-5 sm:px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">

        {/* Top grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-10 mb-12 sm:mb-16">

          {/* Brand — full width on mobile */}
          <div className="col-span-2 lg:col-span-2 space-y-5">
            <Link href="/" className="text-2xl font-black tracking-tighter flex items-center gap-3 hover:opacity-80 transition-all origin-left w-fit">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF5500] to-[#FFB000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FF5500]/20 flex-shrink-0">
                <Music className="w-6 h-6 text-white" />
              </div>
              <span className="uppercase text-white tracking-[0.1em]">BEATTODAY</span>
            </Link>
            <p className="text-text-muted text-sm font-medium leading-relaxed max-w-sm">
              Africa&apos;s premier beat licensing marketplace. Empowering producers to build global businesses and artists to find the perfect sound.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-text-muted hover:text-white hover:bg-[#FF5500]/10 hover:border-[#FF5500]/30 transition-all group"
                >
                  <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </a>
              ))}
            </div>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="font-black uppercase tracking-[0.2em] text-xs text-white mb-4 sm:mb-6">Marketplace</h4>
            <ul className="space-y-2.5 sm:space-y-3 text-sm font-medium text-text-muted">
              <li><Link href="/search" className="hover:text-[#FF5500] transition-colors">Explore All</Link></li>
              <li><Link href="/search?genre=Afrobeats" className="hover:text-[#FF5500] transition-colors">Afrobeats</Link></li>
              <li><Link href="/search?genre=Amapiano" className="hover:text-[#FF5500] transition-colors">Amapiano</Link></li>
              <li><Link href="/search?genre=Drill" className="hover:text-[#FF5500] transition-colors">Drill Beats</Link></li>
              <li><Link href="/charts" className="hover:text-[#FF5500] transition-colors">Beat Charts</Link></li>
            </ul>
          </div>

          {/* User Links (Account/Producer) */}
          <div>
            <h4 className="font-black uppercase tracking-[0.2em] text-xs text-white mb-4 sm:mb-6">
              {role === 'producer' ? 'Producers' : 'Account'}
            </h4>
            <ul className="space-y-2.5 sm:space-y-3 text-sm font-medium text-text-muted">
              {role === 'producer' ? (
                <>
                  <li><Link href="/dashboard" className="hover:text-[#FFB000] transition-colors">Dashboard</Link></li>
                  <li><Link href="/dashboard/upload" className="hover:text-[#FFB000] transition-colors">Upload Beats</Link></li>
                </>
              ) : (
                <>
                  <li><Link href="/library" className="hover:text-[#FFB000] transition-colors">My Library</Link></li>
                  <li><Link href="/signup?role=producer" className="hover:text-[#FFB000] transition-colors">Sell Your Beats</Link></li>
                </>
              )}
              <li><Link href="/pricing" className="hover:text-[#FFB000] transition-colors">Pricing Plans</Link></li>
              <li><Link href="/guides" className="hover:text-[#FFB000] transition-colors">Help Guides</Link></li>
            </ul>
          </div>

          {/* Company — full width on mobile (col-span-2) */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <h4 className="font-black uppercase tracking-[0.2em] text-xs text-white mb-4 sm:mb-6">Company</h4>
            <div className="space-y-2.5 sm:space-y-3 text-sm font-medium text-text-muted">
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <a href="mailto:support@beattoday.com" className="hover:text-white transition-colors break-all">support@beattoday.com</a>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                <span>Accra · Lagos · Nairobi</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 sm:pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            <span>&copy; {new Date().getFullYear()} BEATTODAY. All rights reserved.</span>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/licensing" className="hover:text-white transition-colors">License Info</Link>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-text-muted/40">
            Powered by Paystack
          </div>
        </div>
      </div>
    </footer>
  )
}
