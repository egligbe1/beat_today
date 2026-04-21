'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/stores/cartStore'
import { Music, LayoutDashboard, LogOut, ShoppingCart, Globe, Search, ChevronDown, AlertCircle, Play } from 'lucide-react'
import { useCurrency } from '@/lib/providers/CurrencyProvider'
import NavbarSearch from './NavbarSearch'
import NotificationBell from '@/components/notifications/NotificationBell'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false)
  const currencyRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const { items, setIsOpen } = useCartStore()
  const { currency, setCurrency } = useCurrency()

  const CURRENCIES = ['USD', 'NGN', 'GHS', 'ZAR', 'KES', 'GBP', 'EUR']

  useEffect(() => {
    let mounted = true;

    async function fetchUserAndRole(authUser: any = null) {
      try {
        setLoadingRole(true);
        const currentUser = authUser || (await supabase.auth.getUser()).data.user;
        
        if (!currentUser) {
          if (mounted) {
            setUser(null);
            setRole(null);
            setLoadingRole(false);
          }
          return;
        }

        if (mounted) setUser(currentUser);

        const { data: profile, error } = await supabase
          .from('users_profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();

        if (mounted) {
          if (error) {
            console.error('Error fetching profile:', error);
            setRole(null);
          } else {
            setRole(profile?.role || null);
          }
          setLoadingRole(false);
        }
      } catch (err) {
        console.error('Unexpected error in Navbar state:', err);
        if (mounted) setLoadingRole(false);
      }
    }

    fetchUserAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserAndRole(session?.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [supabase])

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setIsCurrencyOpen(false)
      }
    }
    if (isCurrencyOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isCurrencyOpen])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' })
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-[100] w-full bg-black/60 backdrop-blur-3xl border-b border-white/5" style={{ height: '64px' }}>
      <div className="h-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3">

        {/* ── Left: Logo + nav links ── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-[#FF5500] to-[#FFB000] rounded-xl flex items-center justify-center shadow-lg shadow-[#FF5500]/20 flex-shrink-0">
              <Music className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:block uppercase text-white tracking-[0.1em] text-sm font-black">BeatToday</span>
          </Link>

          <Link href="/charts" className="hidden lg:block text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-[#FF5500] transition-colors">
            Charts
          </Link>
          <Link href="/explore" className="hidden lg:block text-[11px] font-black uppercase tracking-widest text-[#FF5500] hover:text-white transition-colors flex items-center gap-1 bg-[#FF5500]/10 px-2 py-0.5 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5500] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF5500]"></span>
            </span>
            Explore
          </Link>
        </div>

        {/* ── Center: Search (desktop) ── */}
        <div className="flex-1 hidden md:flex justify-center px-4">
          <div className="w-full max-w-sm lg:max-w-md">
            <Suspense fallback={<div className="w-full h-9 bg-white/5 rounded-full animate-pulse border border-white/5" />}>
              <NavbarSearch />
            </Suspense>
          </div>
        </div>

        {/* ── Spacer: pushes right section to edge on mobile ── */}
        <div className="flex-1 md:hidden" />

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">

          {/* Mobile search icon */}
          <Link
            href="/search"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-text-muted hover:text-white transition-colors"
          >
            <Search className="w-4 h-4" />
          </Link>

          {/* Mobile Explore icon */}
          <Link
            href="/explore"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/20 text-[#FF5500] hover:bg-[#FF5500]/20 transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </Link>

          {/* Currency — desktop only */}
          <div className="hidden lg:block relative" ref={currencyRef}>
            <button
              onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 hover:border-white/20 transition-all text-white active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">{currency}</span>
              <ChevronDown className={`w-3 h-3 text-text-muted transition-transform duration-200 ${isCurrencyOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCurrencyOpen && (
              <div className="absolute top-full right-0 mt-2 w-32 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-1 px-2 py-2 border-b border-white/5 bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted px-2">Currency</p>
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCurrency(c as any)
                        setIsCurrencyOpen(false)
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-bold transition-all flex items-center justify-between group ${
                        currency === c 
                          ? 'text-accent-orange bg-white/5' 
                          : 'text-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{c}</span>
                      {currency === c && <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_8px_rgba(255,85,0,0.6)]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notification bell */}
          {user && <NotificationBell />}

          {/* Cart */}
          <button
            onClick={() => setIsOpen(true)}
            className="relative h-9 px-2.5 sm:px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:block text-xs font-bold">Cart</span>
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF5500] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(255,85,0,0.6)]">
                {items.length}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Auth */}
          {user ? (
            <div className="flex items-center gap-1.5">
              {/* Dashboard Link (Role-Specific) */}
              {loadingRole ? (
                <div className="h-9 w-24 sm:w-32 bg-white/5 animate-pulse rounded-xl border border-white/5" />
              ) : !role ? (
                <Link
                  href="/complete-profile"
                  className="h-9 px-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:block text-[10px]">Complete Profile</span>
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border border-white/5"
                >
                  <LayoutDashboard className={role === 'producer' ? "w-4 h-4 text-[#FF5500] flex-shrink-0" : "w-4 h-4 text-blue-400 flex-shrink-0"} />
                  <span className="hidden sm:block">{role === 'producer' ? 'Dashboard' : 'Artist Hub'}</span>
                </Link>
              )}

              {/* Library Link (Artist Only - Producers have it in their dashboard) */}
              {role !== 'producer' && (
                <Link
                  href="/library"
                  className="hidden md:flex h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-wider items-center gap-1.5 transition-all border border-white/5"
                >
                  <Music className="w-4 h-4 text-[#FFB000] flex-shrink-0" />
                  <span>My Library</span>
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block text-xs font-black uppercase tracking-widest text-text-muted hover:text-white transition-all">
                Login
              </Link>
              <Link
                href="/signup"
                className="h-9 px-4 sm:px-5 bg-[#FF5500] text-white rounded-full font-black uppercase tracking-wider text-xs flex items-center justify-center hover:bg-[#FF5500]/90 transition-all active:scale-95 shadow-[0_4px_14px_rgba(255,85,0,0.35)]"
              >
                Join
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}
