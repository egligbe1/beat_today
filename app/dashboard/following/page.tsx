import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserPlus } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default async function FollowingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch followed producers
  const { data: following, error } = await supabase
    .from('follows')
    .select(`
      id,
      following_id,
      producer:users_profiles!following_id (
        handle,
        display_name,
        avatar_url,
        bio
      )
    `)
    .eq('follower_id', user.id)

  if (error) {
    console.error('Error fetching following:', error)
  }

  const followedProducers = following?.map(f => f.producer).filter(Boolean) || []

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Following</h1>
        <p className="text-text-muted">Stay updated with your favorite producers.</p>
      </div>

      {followedProducers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {followedProducers.map((producer: any) => (
            <Link 
              key={producer.handle}
              href={`/@${producer.handle}`}
              className="group bg-bg-surface border border-border-subtle p-6 rounded-[32px] hover:border-white transition-all hover:shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-bg-elevated border border-white/10 group-hover:scale-105 transition-transform">
                  {producer.avatar_url ? (
                    <Image src={producer.avatar_url} alt={producer.display_name} fill className="object-cover" />
                  ) : (
                    <Users className="w-8 h-8 text-text-muted m-auto absolute inset-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{producer.display_name}</h3>
                  <p className="text-sm text-text-muted">@{producer.handle}</p>
                </div>
              </div>
              {producer.bio && (
                <p className="text-sm text-text-muted line-clamp-2 leading-relaxed">
                  {producer.bio}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-bg-surface border border-dashed border-border-subtle rounded-[32px] space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Users className="w-10 h-10 text-white/20" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-white">No following yet</h3>
            <p className="text-sm text-text-muted">
              Follow producers to get their latest updates and new beats in your feed.
            </p>
          </div>
          <Link 
            href="/search"
            className="h-14 px-8 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <UserPlus className="w-5 h-5" /> Discover Producers
          </Link>
        </div>
      )}
    </div>
  )
}
