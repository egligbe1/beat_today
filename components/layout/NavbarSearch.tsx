'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, Music } from 'lucide-react'
import Link from 'next/link'

interface BeatResult {
  id: string
  title: string
  producer_name: string
  producer_handle: string
  genre: string
  cover_url: string
}

export default function NavbarSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BeatResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [modifierKey, setModifierKey] = useState('Cmd')

  // Keyboard shortcut + click-outside
  useEffect(() => {
    // Detect OS for shortcut display
    const isMac = typeof window !== 'undefined' && (
      navigator.userAgent.toLowerCase().includes('mac') || 
      navigator.platform.toLowerCase().includes('mac')
    )
    setModifierKey(isMac ? 'Cmd' : 'Ctrl')

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Search for beats and producers
  useEffect(() => {
    const searchBeats = async () => {
      if (query.trim().length < 1) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        // Fetch matching beats
        const { data: beats, error: beatsError } = await supabase
          .from('beats')
          .select('id, title, genre, cover_url, mood_tags, users_profiles!producer_id(display_name, handle)')
          .eq('status', 'active')
          .or(`title.ilike.%${query}%,genre.ilike.%${query}%,mood_tags.cs.{${query}}`)
          .limit(5)

        if (beatsError) throw beatsError

        // Fetch matching producers
        const { data: producers, error: producersError } = await supabase
          .from('users_profiles')
          .select('handle, display_name, avatar_url')
          .eq('role', 'producer')
          .or(`display_name.ilike.%${query}%,handle.ilike.%${query}%`)
          .limit(3)

        if (producersError) throw producersError

        const formattedResults = [
          ...(beats?.map((beat: any) => ({
            id: beat.id,
            type: 'beat',
            title: beat.title,
            subtitle: `by ${beat.users_profiles?.display_name || 'Unknown'} • ${beat.genre}`,
            image: beat.cover_url
          })) || []),
          ...(producers?.map((p: any) => ({
            id: p.handle,
            type: 'producer',
            title: p.display_name || p.handle,
            subtitle: `@${p.handle}`,
            image: p.avatar_url
          })) || [])
        ]

        setResults(formattedResults)
        setIsOpen(formattedResults.length > 0)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchBeats, 250)
    return () => clearTimeout(debounceTimer)
  }, [query, supabase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setIsOpen(false)
    }
  }

  const handleResultClick = (item: any) => {
    if (item.type === 'beat') {
      router.push(`/beats/${item.id}`)
    } else {
      router.push(`/producer/${item.id}`)
    }
    setIsOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={searchRef} className="relative group w-full">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-[#FF5500] transition-colors" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search beats, producers, genres..."
          className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-full pl-12 pr-6 py-2.5 text-sm focus:outline-none focus:border-[#FF5500]/50 focus:bg-white/[0.08] transition-all text-white placeholder:text-text-muted/50"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] font-black text-text-muted/50 uppercase tracking-tighter">
          <span>{modifierKey}</span>
          <span>K</span>
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-8 text-center text-text-muted flex flex-col items-center justify-center gap-3">
                <div className="animate-spin w-8 h-8 border-3 border-[#FF5500] border-t-transparent rounded-full opacity-60"></div>
                <p className="text-xs font-black uppercase tracking-[0.2em]">Dialing into the lab...</p>
              </div>
            ) : query.length < 1 ? (
              <div className="p-2">
                <div className="p-4 mb-1">
                  <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">Quick Links</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['Afrobeats', 'Amapiano', 'Trap', 'Drill'].map(tag => (
                      <Link 
                        key={tag}
                        href={`/search?genre=${tag}`}
                        onClick={() => setIsOpen(false)}
                        className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-[#FF5500]/30 hover:bg-[#FF5500]/5 text-xs font-bold text-white transition-all text-center"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="p-2">
                {results.some(r => r.type === 'beat') && (
                  <div className="mt-2 mb-1">
                    <h3 className="px-4 py-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Beats</h3>
                    {results.filter(r => r.type === 'beat').map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleResultClick(item)}
                        className="w-full p-3 hover:bg-white/5 rounded-xl transition-all text-left flex items-center gap-3 group"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-bg-primary flex-shrink-0 border border-white/5">
                          {item.image ? (
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <Music className="w-5 h-5 text-text-muted m-auto" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm truncate group-hover:text-[#FF5500] transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-text-muted truncate mt-0.5">
                            {item.subtitle}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {results.some(r => r.type === 'producer') && (
                  <div className="mt-4 mb-1 border-t border-white/5 pt-3">
                    <h3 className="px-4 py-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Producers</h3>
                    <div className="grid grid-cols-1 gap-1">
                      {results.filter(r => r.type === 'producer').map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleResultClick(item)}
                          className="w-full p-3 hover:bg-white/5 rounded-xl transition-all text-left flex items-center gap-3 group"
                        >
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-bg-primary flex-shrink-0 border border-white/5">
                            {item.image ? (
                              <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#FF5500]/10 font-bold text-[#FF5500]">
                                {item.title.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-white text-sm truncate group-hover:text-[#FF5500] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-text-muted truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 border-t border-white/5 p-4 bg-white/[0.02]">
                  <button
                    onClick={() => {
                      if (query.trim()) {
                        router.push(`/search?q=${encodeURIComponent(query.trim())}`)
                        setIsOpen(false)
                      }
                    }}
                    className="w-full h-11 flex items-center justify-center bg-[#FF5500] hover:bg-[#ff6a1f] text-white text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-[#FF5500]/10"
                  >
                    View all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              </div>
            ) : query.length >= 1 && !isLoading ? (
              <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center gap-4">
                 <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                    <Search className="w-5 h-5 opacity-20" />
                 </div>
                 <div>
                    <h4 className="text-white font-bold text-sm mb-1">No results found</h4>
                    <p className="text-xs text-text-muted">Try searching for a different sound or producer</p>
                 </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}