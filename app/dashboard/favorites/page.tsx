import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BeatCard from '@/components/beats/BeatCard'
import { Heart, Music } from 'lucide-react'
import Link from 'next/link'

export default async function FavoritesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch favorites with beat details
  const { data: favorites, error } = await supabase
    .from('beat_favorites')
    .select(`
      id,
      beat_id,
      beats (
        *,
        producer:producer_settings(display_name, avatar_url)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching favorites:', error)
  }

  const favoritedBeats = favorites?.map(f => f.beats).filter(Boolean) || []

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white uppercase tracking-tight">Your Favorites</h1>
        <p className="text-text-muted">Quickly access all the beats you've liked.</p>
      </div>

      {favoritedBeats.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favoritedBeats.map((beat: any) => (
            <BeatCard key={beat.id} beat={beat} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-bg-surface border border-dashed border-border-subtle rounded-[32px] space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Heart className="w-10 h-10 text-white/20" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-bold text-white">No favorites yet</h3>
            <p className="text-sm text-text-muted">
              Start browsing and tap the heart icon on any beat to save it for later.
            </p>
          </div>
          <Link 
            href="/search"
            className="h-14 px-8 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            <Music className="w-5 h-5" /> Browse Beats
          </Link>
        </div>
      )}
    </div>
  )
}
