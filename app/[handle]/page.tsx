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

  // getSession() reads the cookie locally (no network); run the follow-status
  // check and the followers count together instead of in series.
  const { data: { session } } = await supabase.auth.getSession()
  const viewerId = session?.user?.id

  const [followRes, followersRes] = await Promise.all([
    viewerId
      ? supabase.from('follows').select('follower_id').eq('follower_id', viewerId).eq('following_id', profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
  ])
  const isFollowing = !!followRes.data
  const followersCount = followersRes.count

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

    // beats and services are independent — fetch them together.
    const [beatsRes, servicesRes] = await Promise.all([
      supabase
        .from('beats')
        .select('*, users_profiles!beats_producer_id_fkey!inner(handle, display_name)')
        .eq('producer_id', profile.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('producer_services')
        .select('*')
        .eq('producer_id', profile.id)
        .eq('is_active', true),
    ])
    const beats = beatsRes.data
    const services = servicesRes.data

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
      profile, settings, beats, beatsCount, totalPlays, producerRating, totalReviews, followersCount, isFollowing, services
    })
  } else {
    // ---- ARTIST VIEW LOGIC ----
    const { data: favorites } = await supabase
      .from('favorites')
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

function renderProducerProfile({ profile, settings, beats, beatsCount, totalPlays, producerRating, totalReviews, followersCount, isFollowing, services }: any) {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Premium Header/Banner */}
      <div className="relative pt-24 pb-12 md:pt-40 md:pb-24 border-b border-border-subtle bg-bg-surface overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-0 right-0 w-[500px] h-full bg-accent-orange/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[500px] h-full bg-accent-gold/5 blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-end text-center md:text-left">
            {/* Avatar */}
            <div className="relative w-40 md:w-56 aspect-square rounded-[2rem] overflow-hidden border-[6px] border-bg-primary shadow-2xl group cursor-pointer bg-bg-elevated transition-transform hover:scale-[1.02]">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
              ) : (
                <Music2 className="w-20 h-20 text-text-muted m-auto absolute inset-0" />
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-5">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    {(settings?.subscription_tier || '').toUpperCase() === 'PRO' && (
                        <span className="bg-gradient-to-r from-[#FFB000] to-[#FF5500] text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] flex items-center gap-2 shadow-[0_0_30px_rgba(255,176,0,0.3)]">
                            <TrendingUp className="w-3.5 h-3.5" /> PRO Producer
                        </span>
                    )}
                    <span className="text-[#00E676] text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2 bg-[#00E676]/10 px-4 py-1.5 rounded-full border border-[#00E676]/20">
                        <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse"></span>
                        Verified Authentic
                    </span>
                </div>

                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter italic uppercase leading-none drop-shadow-2xl">
                    {profile.display_name}
                </h1>

                <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 sm:gap-8">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Location</span>
                        <span className="flex items-center gap-2 text-sm font-bold text-white"><MapPin className="w-4 h-4 text-accent-orange" /> {profile.country || 'Global'}</span>
                    </div>
                    <div className="w-px h-10 bg-white/5 hidden sm:block" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Catalog</span>
                        <span className="flex items-center gap-2 text-sm font-bold text-white"><Music className="w-4 h-4 text-[#FFB000]" /> {beatsCount || 0} Beats</span>
                    </div>
                    <div className="w-px h-10 bg-white/5 hidden sm:block" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-text-muted font-black uppercase tracking-widest mb-1">Community</span>
                        <span className="flex items-center gap-2 text-sm font-bold text-white"><Users className="w-4 h-4 text-[#FF5500]" /> {followersCount || 0} Follows</span>
                    </div>
                </div>

                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 pt-2">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-xl">
                        <div className="flex items-center gap-1.5">
                            <Star className="w-4 h-4 text-[#FFB000] fill-current" />
                            <span className="text-base font-black text-white leading-none">{producerRating}</span>
                        </div>
                        <span className="w-px h-4 bg-white/10" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Artist Rating ({totalReviews})</span>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-xl">
                        <span className="text-base font-black text-white leading-none">{totalPlays.toLocaleString()}</span>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">Global Plays</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto pt-6 md:pt-0">
                <FollowButton followingId={profile.id} initialIsFollowing={isFollowing} className="h-14 px-10 text-sm font-black uppercase tracking-widest rounded-2xl w-full sm:w-auto" />
                <ContactButton producerId={profile.id} className="h-14 px-8 text-sm font-black uppercase tracking-widest rounded-2xl w-full sm:w-auto border-2 border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10" />
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
                services={services || []}
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
      <div className="relative pt-24 pb-12 md:pt-32 md:pb-20 border-b border-border-subtle bg-bg-surface overflow-hidden">
        {/* Subtle Background Glow for Artists */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-primary to-transparent opacity-80 z-10" />
        <div className="absolute top-0 right-0 w-[500px] h-full bg-blue-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[500px] h-full bg-accent-orange/5 blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-20">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-end text-center md:text-left">
            {/* Avatar */}
            <div className="relative w-40 md:w-48 aspect-square rounded-full overflow-hidden border-[6px] border-bg-primary shadow-2xl group cursor-pointer bg-bg-elevated transition-transform hover:scale-[1.02]">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <Users className="w-20 h-20 text-text-muted m-auto absolute inset-0" />
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1 space-y-4 mb-2">
                <div className="flex justify-center md:justify-start">
                    <span className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                        Recording Artist
                    </span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase leading-none drop-shadow-2xl">
                    {profile.display_name}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start items-center gap-6 sm:gap-8 text-sm text-text-muted font-bold">
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-accent-orange" /> {profile.country || 'Global'}</span>
                    <span className="flex items-center gap-2 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20 text-blue-400">
                        <Users className="w-4 h-4" /> {followersCount || 0} Followers
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-2 w-full md:w-auto">
                <FollowButton followingId={profile.id} initialIsFollowing={isFollowing} className="h-14 px-10 text-sm font-black uppercase tracking-widest rounded-2xl w-full sm:w-auto" />
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
