import VerticalFeed from '@/components/explore/VerticalFeed'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ExplorePage() {
  const supabase = createClient()
  
  // Fetch User and Beats in parallel
  const [userRes, beatsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('beats')
      .select(`
        id, title, cover_url, mp3_preview_url, price_mp3, 
        price_wav, price_trackout, price_exclusive, is_exclusive_sold, is_free,
        producer_id, genre, bpm, key, play_count, created_at,
        users_profiles!beats_producer_id_fkey(
          handle, 
          display_name, 
          avatar_url,
          producer_settings(subscription_tier)
        ),
        favorites:favorites(count),
        beat_comments(count)
      `)
      .eq('status', 'active')
      .limit(40)
  ])

  const user = userRes.data.user
  let { data: rawBeats } = beatsRes

  // 3. Fetch User State if logged in
  let followingIds: string[] = []
  let favoritedIds: string[] = []

  if (user) {
    const [followsRes, favoritesRes] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('favorites').select('beat_id').eq('user_id', user.id)
    ])

    if (followsRes.data) followingIds = followsRes.data.map(f => f.following_id)
    if (favoritesRes.data) favoritedIds = favoritesRes.data.map(f => f.beat_id)
  }

  let beats: any[] = []

  if (rawBeats) {
    // Apply Trending + Tier Algorithm in memory for high-performance blending
    beats = (rawBeats as any[]).map((beat: any) => {
      // Handle the nested structure from Supabase
      const profile = Array.isArray(beat.users_profiles) ? beat.users_profiles[0] : beat.users_profiles
      const tier = profile?.producer_settings?.[0]?.subscription_tier || 'FREE'
      
      const likes = beat.favorites?.[0]?.count || 0
      const comments = beat.beat_comments?.[0]?.count || 0
      const plays = beat.play_count || 0
      
      const tierScore = tier === 'PRO' ? 10000 : (tier === 'STARTER' ? 5000 : 0)
      const engagementScore = (plays * 1) + (likes * 10) + (comments * 20)
      const hoursOld = (Date.now() - new Date(beat.created_at).getTime()) / 1000 / 3600
      
      const score = (tierScore + engagementScore) - (hoursOld * 5)
      
      // Clean up the object to match FeedBeat interface exactly
      const { producer_settings, ...cleanProfile } = profile || {}
      
      return { 
        ...beat, 
        users_profiles: cleanProfile,
        discovery_score: score 
      }
    }).sort((a: any, b: any) => b.discovery_score - a.discovery_score)
      .slice(0, 20)
  }

  return (
    <div className="bg-black text-white h-[100dvh] fixed inset-0 z-[100] overflow-hidden">
      <VerticalFeed 
        initialBeats={beats || []} 
        initialFollowingIds={followingIds}
        initialFavoritedIds={favoritedIds}
      />
    </div>
  )
}
