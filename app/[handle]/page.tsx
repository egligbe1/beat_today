import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'

export const revalidate = 0
import FollowButton from '@/components/profile/FollowButton'
import ContactButton from '@/components/profile/ContactButton'
import ProfileTabsContainer from '@/components/profile/ProfileTabsContainer'
import BeatCard from '@/components/beats/BeatCard'
import { MapPin, Music, Users, Music2, TrendingUp, Star, Globe, Heart } from 'lucide-react'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const supabase = createClient()
  const cleanHandle = decodeURIComponent(params.handle).replace(/^@/, '')
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('display_name, bio, avatar_url, role')
    .eq('handle', cleanHandle)
    .single()

  if (!profile) return { title: 'Profile Not Found — BeatToday' }

  const roleText = profile.role === 'producer' ? 'Producer' : 'Artist'
  const title = `${profile.display_name} — ${roleText} on BeatToday`
  const description = profile.bio || `View ${profile.display_name}'s profile on BeatToday.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: profile.avatar_url ? [profile.avatar_url] : [],
    },
  }
}

export default async function UserProfilePage({ params }: { params: { handle: string } }) {
  const supabase = createClient()
  const cleanHandle = decodeURIComponent(params.handle).replace(/^@/, '')

  const { data: profile, error } = await supabase
    .from('users_profiles')
    .select('*, producer_settings(*)')
    .eq('handle', cleanHandle)
    .single()

  if (error || !profile) {
    return notFound()
  }

  // Get current user and follow status
  const { data: { session } } = await supabase.auth.getSession()
  let isFollowing = false
  if (session?.user) {
    const { data: follow } = await supabase
      .from('follows')
      .select('*')
      .eq('follower_id', session.user.id)
      .eq('following_id', profile.id)
      .maybeSingle()
    isFollowing = !!follow
  }

  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id)

  const isProducer = profile.role === 'producer'

  if (isProducer) {
    // ---- PRODUCER VIEW LOGIC ----
    let settings = Array.isArray(profile.producer_settings) 
      ? profile.producer_settings[0] 
      : profile.producer_settings

    if (!settings) {
      const { data: fallbackSettings } = await supabase
        .from('producer_settings')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle()
      settings = fallbackSettings
    }

    const { data: beats } = await supabase
      .from('beats')
      .select('*, users_profiles!beats_producer_id_fkey!inner(handle, display_name)')
      .eq('producer_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const beatsCount = beats?.length || 0
    const aggregatedPlays = beats?.reduce((sum, b) => sum + (b.play_count || 0), 0) || 0
    const totalPlays = Math.max(settings?.total_plays || 0, aggregatedPlays)

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

    return renderProducerProfile({
      profile, settings, beats, beatsCount, totalPlays, producerRating, totalReviews, followersCount, isFollowing
    })
  } else {
    // ---- ARTIST VIEW LOGIC ----
    const { data: favorites } = await supabase
      .from('beat_favorites')
      .select(`
        beats (
          *,
          users_profiles!beats_producer_id_fkey!inner(handle, display_name)
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(12)

    const favoritedBeats = favorites?.map(f => f.beats).filter(Boolean) || []

    return renderArtistProfile({
      profile, followersCount, isFollowing, favoritedBeats
    })
  }
}

function renderProducerProfile({ profile, settings, beats, beatsCount, totalPlays, producerRating, totalReviews, followersCount, isFollowing }: any) {
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
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover group-hover:scale-110 transition-transform" />
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
                    {profile.display_name}
                </h1>
                <div className="flex flex-wrap items-center gap-6 text-sm text-text-muted font-bold">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent-orange" /> {profile.country || 'Global'}</span>
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
                <FollowButton followingId={profile.id} initialIsFollowing={isFollowing} />
                <ContactButton producerId={profile.id} />
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
                        {profile.bio || `Professional producer crafting high-quality sounds. Specializing in ${profile.country} influenced global beats.`}
                    </p>
                    <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
                         <span className="text-xs text-text-muted font-bold uppercase tracking-widest">Share Profile</span>
                         <span className="text-[10px] text-accent-orange font-bold uppercase bg-bg-primary border border-border-subtle px-3 py-1 rounded cursor-pointer hover:bg-bg-elevated">Copy Link</span>
                    </div>
                </div>

                {profile.social_links && Object.values(profile.social_links).some(Boolean) && (
                  <div className="bg-bg-surface p-6 rounded-3xl border border-border-subtle space-y-4">
                      <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted">Social Links</h3>
                      <div className="space-y-3">
                          {profile.social_links.website && (
                            <a href={profile.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-white transition-colors">
                              <Globe className="w-4 h-4" /> Website
                            </a>
                          )}
                          {profile.social_links.instagram && (
                             <a href={`https://instagram.com/${profile.social_links.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#E1306C] transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">IG</span>
                               {profile.social_links.instagram}
                             </a>
                          )}
                          {profile.social_links.twitter && (
                             <a href={`https://twitter.com/${profile.social_links.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-sky-400 transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">X</span>
                               {profile.social_links.twitter}
                             </a>
                          )}
                      </div>
                  </div>
                )}
            </div>

            {/* Main Content: Interactive Tabs Container */}
            <ProfileTabsContainer 
                beats={beats || []} 
                producer={profile} 
                totalPlays={totalPlays}
                totalReviews={totalReviews}
            />

        </div>
      </div>
    </div>
  )
}

function renderArtistProfile({ profile, followersCount, isFollowing, favoritedBeats }: any) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Artist Header/Banner */}
      <div className="relative h-[300px] border-b border-border-subtle bg-bg-surface overflow-hidden">
        {/* Subtle Background Glow for Artists */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary to-transparent opacity-80 z-10" />
        <div className="absolute top-0 right-0 w-[500px] h-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[500px] h-full bg-accent-orange/5 blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 h-full flex flex-col justify-end pb-8">
          <div className="flex flex-col md:flex-row gap-8 items-end relative z-20">
            {/* Avatar */}
            <div className="relative w-32 md:w-40 aspect-square rounded-full overflow-hidden border-4 border-bg-primary shadow-xl group cursor-pointer bg-bg-elevated">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <Users className="w-16 h-16 text-text-muted m-auto absolute inset-0" />
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-3 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-text-muted text-[10px] font-black uppercase tracking-widest bg-bg-elevated border border-border-subtle px-3 py-1 rounded-full">
                        Recording Artist
                    </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    {profile.display_name}
                </h1>
                <div className="flex flex-wrap items-center gap-6 text-sm text-text-muted font-bold">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent-orange" /> {profile.country || 'Global'}</span>
                    <span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> {followersCount || 0} Followers</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mb-2">
                <FollowButton followingId={profile.id} initialIsFollowing={isFollowing} />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-8">
                <div className="bg-bg-surface p-6 rounded-3xl border border-border-subtle space-y-4">
                    <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted">About Artist</h3>
                    <p className="text-text-muted leading-relaxed text-sm">
                        {profile.bio || `Artist based in ${profile.country || 'the world'}, discovering new sounds on BeatToday.`}
                    </p>
                </div>

                {profile.social_links && Object.values(profile.social_links).some(Boolean) && (
                  <div className="bg-bg-surface p-6 rounded-3xl border border-border-subtle space-y-4">
                      <h3 className="font-bold uppercase tracking-widest text-sm text-text-muted">Social Links</h3>
                      <div className="space-y-3">
                          {profile.social_links.website && (
                            <a href={profile.social_links.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-white transition-colors">
                              <Globe className="w-4 h-4" /> Website
                            </a>
                          )}
                          {profile.social_links.instagram && (
                             <a href={`https://instagram.com/${profile.social_links.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-[#E1306C] transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">IG</span>
                               {profile.social_links.instagram}
                             </a>
                          )}
                          {profile.social_links.twitter && (
                             <a href={`https://twitter.com/${profile.social_links.twitter.replace('@','')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-text-muted hover:text-sky-400 transition-colors font-bold">
                               <span className="w-4 h-4 flex items-center justify-center text-[10px] font-black border border-current rounded">X</span>
                               {profile.social_links.twitter}
                             </a>
                          )}
                      </div>
                  </div>
                )}
            </div>

            {/* Main Content: Favorite Tracks */}
            <div className="lg:col-span-8 space-y-8">
               <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                   <Heart className="w-6 h-6 text-accent-orange" />
                   <h2 className="text-2xl font-black text-white">Favorite Tracks</h2>
               </div>

               {favoritedBeats.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favoritedBeats.map((beat: any) => (
                      <BeatCard key={beat.id} beat={beat} />
                    ))}
                 </div>
               ) : (
                 <div className="bg-bg-surface border border-dashed border-border-subtle rounded-3xl p-12 text-center flex flex-col items-center">
                    <Music className="w-12 h-12 text-text-muted/50 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">{profile.display_name} hasn&apos;t favorited any beats yet.</h3>
                    <p className="text-text-muted text-sm">When they like tracks, they will appear here.</p>
                 </div>
               )}
            </div>

        </div>
      </div>
    </div>
  )
}
