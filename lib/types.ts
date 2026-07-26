/**
 * Shared domain types.
 *
 * Several components historically redefined their own local `Beat`/`FeedBeat`
 * interfaces (playerStore, BeatCard, VerticalFeed, QuickLicensePicker), which
 * drift out of sync. Prefer importing from here for new/refactored code.
 */

export type LicenseKind = 'mp3' | 'wav' | 'trackout' | 'exclusive'

/** Minimal shape the global audio player needs to play a track. */
export interface PlayerBeat {
  id: string
  title: string
  producer_name: string
  cover_url: string
  mp3_preview_url: string
}

/** A producer/artist profile as embedded on beats. */
export interface ProfileSummary {
  id?: string
  handle: string
  display_name: string | null
  avatar_url?: string | null
}

/** A catalog beat as returned by the discovery/search views and card grids. */
export interface Beat {
  id: string
  producer_id: string
  title: string
  genre?: string | null
  mood_tags?: string[] | null
  bpm?: number | null
  key?: string | null
  cover_url?: string | null
  mp3_preview_url?: string | null
  watermarked_preview_url?: string | null
  price_mp3?: number | null
  price_wav?: number | null
  price_trackout?: number | null
  price_exclusive?: number | null
  play_count?: number | null
  likes_count?: number | null
  comments_count?: number | null
  is_exclusive_sold?: boolean | null
  is_free?: boolean | null
  status?: string | null
  created_at?: string | null
  users_profiles?: ProfileSummary | null
}
