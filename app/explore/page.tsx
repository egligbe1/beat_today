import VerticalFeed from '@/components/explore/VerticalFeed'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ExplorePage() {
  const supabase = createClient()
  
  // Fetch User and Beats in parallel (Using the pre-calculated Discovery View)
  const [userRes, beatsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('discovery_feed_trending')
      .select(`
        *,
        users_profiles!beats_producer_id_fkey(
          handle, display_name, avatar_url
        )
      `)
      .order('trending_score', { ascending: false })
      .limit(30)
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

  // Map to the expected interface (VerticalFeed expects FeedBeat)
  const beats = (rawBeats || []).map(b => ({
    ...b,
    users_profiles: Array.isArray(b.users_profiles) ? b.users_profiles[0] : b.users_profiles
  }))

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
