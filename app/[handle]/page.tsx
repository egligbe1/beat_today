import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import BeatCard from '@/components/beats/BeatCard'
import FollowButton from '@/components/profile/FollowButton'
import ContactButton from '@/components/profile/ContactButton'
import { MapPin, Music, Users, Music2, TrendingUp, Globe, Star, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const supabase = createClient()
  const cleanHandle = decodeURIComponent(params.handle).replace(/^@/, '')
  const { data: producer } = await supabase
    .from('users_profiles')
    .select('display_name, bio, avatar_url')
    .eq('handle', cleanHandle)
    .eq('role', 'producer')
    .single()

  if (!producer) return { title: 'Producer Not Found — BeatToday' }

  const title = `${producer.display_name} — Producer on BeatToday`
  const description = producer.bio || `Browse and buy beats from ${producer.display_name} on BeatToday.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: producer.avatar_url ? [{ url: producer.avatar_url }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: producer.avatar_url ? [producer.avatar_url] : [],
    },
  }
}

export default async function ProducerProfilePage({ params }: { params: { handle: string } }) {
  const supabase = createClient()
  
  // 1. Clean the handle (handle might come with %40 or @)
  const cleanHandle = decodeURIComponent(params.handle).replace(/^@/, '')

  // 2. Fetch Producer Profile
  const { data: producer, error } = await supabase
    .from('users_profiles')
    .select('*, producer_settings(*)')
    .eq('handle', cleanHandle)
    .eq('role', 'producer')
    .single()

  if (error || !producer) {
    return notFound()
  }

  // 3. Fetch Beats from Producer
  const { data: beats } = await supabase
    .from('beats')
    .select('*, users_profiles!inner(handle, display_name)')
    .eq('producer_id', producer.id)
    .order('created_at', { ascending: false })

  // 4. Fetch Stats (Followers)
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', producer.id)

  const { count: beatsCount } = await supabase
    .from('beats')
    .select('*', { count: 'exact', head: true })
    .eq('producer_id', producer.id)
    .eq('status', 'active')

  const producerRating = Math.min(5, Math.max(1, Math.ceil(Math.log10((producer.producer_settings?.total_plays || 0) + 1))))

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Premium Header/Banner */}
      <div className="relative h-[400px] border-b border-border-subtle bg-bg-surface overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 right-0 w-[500px] h-full bg-accent-orange/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[500px] h-full bg-accent-gold/5 blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 h-full flex flex-col justify-end pb-12">
          <div className="flex flex-col md:flex-row gap-8 items-end relative z-10">
            {/* Avatar */}
            <div className="relative w-32 md:w-48 aspect-square rounded-3xl overflow-hidden border-4 border-bg-primary shadow-2xl group cursor-pointer bg-bg-elevated">
              {producer.avatar_url ? (
                <Image src={producer.avatar_url} alt={producer.display_name} fill className="object-cover group-hover:scale-110 transition-transform" />
              ) : (
                <Music2 className="w-16 h-16 text-text-muted m-auto absolute inset-0" />
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                    {producer.producer_settings?.subscription_tier === 'PRO' && (
                        <span className="bg-gradient-to-r from-[#FFB000] to-[#FF5500] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,176,0,0.3)]">
                            <TrendingUp className="w-3 h-3" /> PRO Member
                        </span>
                    )}
                    {producer.producer_settings?.subscription_tier === 'STARTER' && (
                        <span className="bg-white/10 text-white text-[10px] items-center font-black px-2 py-0.5 rounded-sm uppercase tracking-widest border border-white/10">
                            Starter
                        </span>
                    )}
                    <span className="text-[#00E676] text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse"></span>
                        Verified Authentic
                    </span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-text-primary tracking-tight">
                    {producer.display_name}
                </h1>
                <div className="flex flex-wrap items-center gap-6 text-sm text-text-muted font-bold">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent-orange" /> {producer.country || 'Global'}</span>
                    <span className="flex items-center gap-2"><Music className="w-4 h-4 text-[#FFB000]" /> {beatsCount || 0} Tracks</span>
                    <span className="flex items-center gap-2"><Users className="w-4 h-4 text-[#FF5500]" /> {followersCount || 0} Followers</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                    <span className="inline-flex items-center gap-2 bg-bg-elevated px-3 py-2 rounded-full border border-border-subtle">
                        <Star className="w-4 h-4 text-[#FFB000]" /> {producerRating}.0 Artist Rating
                    </span>
                    <span className="inline-flex items-center gap-2 bg-bg-elevated px-3 py-2 rounded-full border border-border-subtle">
                        <span className="font-bold text-white">{producer.producer_settings?.total_plays?.toLocaleString() || '0'}</span> Total Plays
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <FollowButton followingId={producer.id} initialIsFollowing={false} />
                <ContactButton producerId={producer.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Navigation */}
      <div className="sticky top-0 bg-bg-primary/80 backdrop-blur-xl z-20 border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-10 h-16 text-sm font-bold uppercase tracking-widest text-text-muted">
            <button className="text-accent-orange border-b-2 border-accent-orange h-full">Beats</button>
            <button className="hover:text-text-primary transition-colors">Albums</button>
            <button className="hover:text-text-primary transition-colors">Drumkits</button>
            <button className="hover:text-text-primary transition-colors">Contact</button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Sidebar: Bio & Extras */}
            <div className="lg:col-span-4 space-y-8">
                <div className="bg-bg-surface p-6 rounded-3xl border border-border-subtle space-y-4">
                    <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted">About</h3>
                    <p className="text-text-muted leading-relaxed text-sm">
                        {producer.bio || `Professional producer crafting high-quality sounds. Specializing in ${producer.country} influenced global beats.`}
                    </p>
                    <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
                         <span className="text-xs text-text-muted font-bold uppercase tracking-widest">Share Profile</span>
                         <span className="text-[10px] text-accent-orange font-bold uppercase bg-bg-primary border border-border-subtle px-3 py-1 rounded cursor-pointer hover:bg-bg-elevated">Copy Link</span>
                    </div>
                </div>

                {producer.social_links && Object.values(producer.social_links).some(Boolean) && (
                  <div className="bg-bg-surface p-6 rounded-3xl border border-border-subtle space-y-4">
                      <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted">Social Links</h3>
                      <div className="space-y-3">
                          {producer.social_links.website && (
                            <a href={producer.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-white transition-colors">
                              <Globe className="w-4 h-4" /> Website <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                          {producer.social_links.instagram && (
                            <a href={`https://instagram.com/${producer.social_links.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#E1306C] transition-colors font-bold">
                              <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">IG</span>
                              {producer.social_links.instagram} <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                          {producer.social_links.twitter && (
                            <a href={`https://twitter.com/${producer.social_links.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-sky-400 transition-colors font-bold">
                              <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">X</span>
                              {producer.social_links.twitter} <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                          {producer.social_links.youtube && (
                            <a href={producer.social_links.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-red-500 transition-colors font-bold">
                              <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">YT</span>
                              YouTube <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                          {producer.social_links.soundcloud && (
                            <a href={producer.social_links.soundcloud} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#FF5500] transition-colors font-bold">
                              <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">SC</span>
                              SoundCloud <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                          {producer.social_links.spotify && (
                            <a href={producer.social_links.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#1DB954] transition-colors font-bold">
                              <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">SP</span>
                              Spotify <ExternalLink className="w-3 h-3 ml-auto" />
                            </a>
                          )}
                      </div>
                  </div>
                )}
            </div>

            {/* Main Content: Beats Grid */}
            <div className="lg:col-span-8 space-y-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Latest Releases</h2>
                    <div className="text-xs font-bold uppercase tracking-widest text-text-muted">Sort by: Newest</div>
                </div>

                {beats && beats.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {beats.map((beat) => (
                            <BeatCard key={beat.id} beat={beat} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle">
                        <p className="text-text-muted">No beats published yet.</p>
                    </div>
                )}

                {/* Statistics Overview */}
                <div className="bg-bg-surface p-12 rounded-[40px] border border-border-subtle grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Total Plays</p>
                        <p className="text-3xl font-black">{producer.producer_settings?.total_plays || 0}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Beats Sold</p>
                        <p className="text-3xl font-black">0</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Active Stems</p>
                        <p className="text-3xl font-black">{beatsCount || 0}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Reviews</p>
                        <p className="text-3xl font-black">No reviews</p>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  )
}
