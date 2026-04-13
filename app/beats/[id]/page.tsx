import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Zap, Star } from 'lucide-react'
import LicenseSelector from '@/components/beats/LicenseSelector'
import BeatCard from '@/components/beats/BeatCard'
import BeatPageActions from '@/components/beats/BeatPageActions'
import TrackImage from '@/components/beats/TrackImage'
import ReviewsSection from '@/components/reviews/ReviewsSection'
import { formatCurrency } from '@/lib/utils'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: beat } = await supabase
    .from('beats')
    .select('title, genre, bpm, cover_url, users_profiles!beats_producer_id_fkey(display_name)')
    .eq('id', params.id)
    .single()

  if (!beat) return { title: 'Beat Not Found — BeatToday' }

  const producer = (beat.users_profiles as any)?.display_name || 'Unknown Producer'
  const title = `${beat.title} by ${producer} — BeatToday`
  const description = `Buy "${beat.title}" — ${beat.genre} beat at ${beat.bpm} BPM by ${producer}. Download instantly with full license.`

  return {
    title,
    description,
    openGraph: { title, description, images: beat.cover_url ? [{ url: beat.cover_url, width: 800, height: 800 }] : [], type: 'music.song' },
    twitter: { card: 'summary_large_image', title, description, images: beat.cover_url ? [beat.cover_url] : [] },
  }
}

export default async function BeatDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: beat, error } = await supabase
    .from('beats')
    .select('*, users_profiles!beats_producer_id_fkey(*)')
    .eq('id', params.id)
    .eq('status', 'active')
    .single()

  if (error || !beat) return notFound()

  const { data: relatedBeats } = await supabase
    .from('beats')
    .select('*, users_profiles!beats_producer_id_fkey(handle, display_name)')
    .eq('producer_id', beat.producer_id)
    .neq('id', beat.id)
    .limit(4)

  const popularityRating = Math.min(5, Math.max(1, Math.ceil(Math.log10((beat.play_count || 0) + 1))))

  const licenseBlock = (
    <LicenseSelector
      beat={{
        id: beat.id,
        title: beat.title,
        cover_url: beat.cover_url,
        is_exclusive_sold: beat.is_exclusive_sold,
        users_profiles: { display_name: beat.users_profiles.display_name }
      }}
      prices={{
        mp3: beat.price_mp3,
        wav: beat.price_wav,
        trackout: beat.price_trackout,
        exclusive: beat.price_exclusive
      }}
    />
  )

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-accent-orange/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

          {/* Left: Beat content */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">

            {/* Cover + Info row */}
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
              {/* Artwork */}
              <div className="relative w-full sm:w-64 md:w-72 aspect-square rounded-2xl overflow-hidden shadow-2xl border border-border-subtle bg-bg-elevated flex-shrink-0 mx-auto sm:mx-0 max-w-xs sm:max-w-none">
                <TrackImage src={beat.cover_url} alt={beat.title} />
              </div>

              {/* Info */}
              <div className="flex-1 space-y-4 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-accent-orange/10 text-accent-orange text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg">
                    {beat.genre}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono flex items-center gap-1 bg-bg-surface px-2.5 py-1 rounded-lg border border-border-subtle">
                    <Zap className="w-3 h-3 fill-accent-gold text-accent-gold" /> {beat.status}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-text-primary tracking-tight leading-tight">
                  {beat.title}
                </h1>

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border-subtle overflow-hidden relative flex-shrink-0">
                    {beat.users_profiles?.avatar_url && (
                      <Image src={beat.users_profiles.avatar_url} alt={beat.users_profiles.display_name} fill className="object-cover" />
                    )}
                  </div>
                  <Link href={`/@${beat.users_profiles.handle}`} className="text-base font-bold text-text-muted hover:text-accent-orange transition-colors truncate">
                    @{beat.users_profiles.handle}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center gap-2 bg-bg-surface px-3 py-2 rounded-full border border-border-subtle text-sm text-text-muted">
                    <Star className="w-4 h-4 text-[#FFB000]" /> {popularityRating}.0 Rating
                  </span>
                  <span className="inline-flex items-center gap-2 bg-bg-surface px-3 py-2 rounded-full border border-border-subtle text-sm text-text-muted">
                    <span className="font-bold text-text-primary">{beat.play_count?.toLocaleString() || '0'}</span> Plays
                  </span>
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: 'BPM', value: beat.bpm || '--' },
                    { label: 'Key', value: beat.key || '--' },
                    { label: 'Genre', value: beat.genre },
                    { label: 'Year', value: new Date(beat.created_at).getFullYear() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-bg-surface p-2.5 sm:p-4 rounded-xl border border-border-subtle text-center sm:text-left">
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-text-muted mb-0.5 sm:mb-1 font-bold">{label}</p>
                      <p className="text-sm sm:text-xl font-bold font-mono truncate">{value}</p>
                    </div>
                  ))}
                </div>

                <BeatPageActions beat={{
                  id: beat.id,
                  title: beat.title,
                  producer_name: beat.users_profiles.display_name,
                  cover_url: beat.cover_url,
                  mp3_preview_url: beat.watermark_status === 'done' ? beat.mp3_preview_url : null,
                }} />
                
                {beat.watermark_status !== 'done' && (
                  <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-xl p-3 flex items-center gap-3 mt-4">
                    <div className="w-2 h-2 bg-accent-gold rounded-full animate-bounce" />
                    <p className="text-xs font-bold text-accent-gold uppercase tracking-widest">
                      Audio is currently being watermarked...
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile license selector — shown only on mobile, right after main info */}
            <div className="lg:hidden">
              {licenseBlock}
              <p className="text-[10px] text-center text-text-muted mt-3 uppercase font-bold tracking-widest">
                Secure checkout powered by <span className="text-white">Paystack</span>
              </p>
            </div>

            {/* About + Tags */}
            <div className="bg-bg-surface p-5 sm:p-8 rounded-2xl border border-border-subtle space-y-5">
              <div>
                <h3 className="text-base font-bold mb-2.5">About this Beat</h3>
                <p className="text-text-muted leading-relaxed text-sm sm:text-base">
                  {beat.users_profiles.bio || `This professional ${beat.genre} track was crafted by ${beat.users_profiles.display_name}. Perfect for your next project.`}
                </p>
              </div>
              {beat.mood_tags?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold mb-2.5 uppercase tracking-widest text-text-muted">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {beat.mood_tags.map((tag: string) => (
                      <span key={tag} className="text-xs font-medium bg-bg-elevated px-3 py-1.5 rounded-full border border-border-subtle hover:border-accent-orange transition-colors cursor-pointer">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="space-y-4">
              <h2 className="text-xl font-black uppercase tracking-tight">Reviews</h2>
              <ReviewsSection beatId={beat.id} />
            </div>

            {/* Related Beats */}
            {relatedBeats && relatedBeats.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight">More from {beat.users_profiles.display_name}</h2>
                  <Link href={`/@${beat.users_profiles.handle}`} className="text-sm text-accent-orange font-bold hover:underline flex-shrink-0 ml-4">
                    View All
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {relatedBeats.map((b) => (
                    <BeatCard key={b.id} beat={b} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Desktop license selector — sticky, hidden on mobile */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24 h-fit">
            {licenseBlock}
            <p className="text-[10px] text-center text-text-muted mt-4 uppercase font-bold tracking-widest">
              Secure checkout powered by <span className="text-white">Paystack</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
