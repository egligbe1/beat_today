import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'

export const revalidate = 0
import FollowButton from '@/components/profile/FollowButton'
import ContactButton from '@/components/profile/ContactButton'
import ProfileTabsContainer from '@/components/profile/ProfileTabsContainer'
import { MapPin, Music, Users, Music2, TrendingUp, Star, Globe } from 'lucide-react'
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
  
  // 1. Clean the handle
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

  // Ensure producer_settings exists or fetch it separately as fallback
  let settings = Array.isArray(producer.producer_settings) 
    ? producer.producer_settings[0] 
    : producer.producer_settings

  if (!settings) {
    const { data: fallbackSettings } = await supabase
      .from('producer_settings')
      .select('*')
      .eq('user_id', producer.id)
      .maybeSingle()
    settings = fallbackSettings
  }

  // Get current user and follow status
  const { data: { session } } = await supabase.auth.getSession()
  let isFollowing = false
  if (session?.user) {
    const { data: follow } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', session.user.id)
      .eq('following_id', producer.id)
      .maybeSingle()
    isFollowing = !!follow
  }

  // 3. Fetch Beats from Producer (hardened)
  const { data: beats } = await supabase
    .from('beats')
    .select('*, users_profiles!beats_producer_id_fkey!inner(handle, display_name)')
    .eq('producer_id', producer.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // 4. Fetch Stats
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', producer.id)

  const beatsCount = beats?.length || 0

  const aggregatedPlays = beats?.reduce((sum, b) => sum + (b.play_count || 0), 0) || 0
  const totalPlays = Math.max(settings?.total_plays || 0, aggregatedPlays)

  // 5. Fetch Producer Aggregate Rating from their beats
  const beatIds = beats?.map(b => b.id) || []
  let avgRating = 0
  let totalReviews = 0

  if (beatIds.length > 0) {
    const { data: ratingData } = await supabase
      .from('beat_reviews')
      .select('rating')
      .in('beat_id', beatIds)
    
    totalReviews = ratingData?.length || 0
    if (totalReviews > 0) {
      avgRating = ratingData!.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    }
  }

  const producerRating = totalReviews > 0 ? avgRating.toFixed(1) : "5.0"

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
                    {settings?.subscription_tier === 'pro' && (
                        <span className="bg-gradient-to-r from-[#FFB000] to-[#FF5500] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,176,0,0.3)]">
                            <TrendingUp className="w-3 h-3" /> PRO Member
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
                        <Star className="w-4 h-4 text-[#FFB000]" /> {producerRating} Artist Rating ({totalReviews})
                    </span>
                    <span className="inline-flex items-center gap-2 bg-bg-elevated px-3 py-2 rounded-full border border-border-subtle">
                        <span className="font-bold text-white">{totalPlays.toLocaleString()}</span> Total Plays
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <FollowButton followingId={producer.id} initialIsFollowing={isFollowing} />
                <ContactButton producerId={producer.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Navigation & Content */}
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
                              <Globe className="w-4 h-4" /> Website
                            </a>
                          )}
                          {producer.social_links.instagram && (
                             <a href={`https://instagram.com/${producer.social_links.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#E1306C] transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">IG</span>
                               {producer.social_links.instagram}
                             </a>
                          )}
                          {producer.social_links.twitter && (
                             <a href={`https://twitter.com/${producer.social_links.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-sky-400 transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">X</span>
                               {producer.social_links.twitter}
                             </a>
                          )}
                      </div>
                  </div>
                )}
            </div>

            {/* Main Content: Interactive Tabs Container */}
            <ProfileTabsContainer 
                beats={beats || []} 
                producer={producer} 
                totalPlays={totalPlays}
                totalReviews={totalReviews}
            />

        </div>
      </div>
    </div>
  )
}
