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

export type StudioProjectStatus = 'AWAITING_AGREEMENT' | 'AGREED' | 'IN_PRODUCTION' | 'ON_HOLD'
export interface StudioWorkspace {
  id: string; owner_id: string; name: string; city: string; timezone: string
}
export interface StudioProject {
  id: string; studio_id: string; producer_id: string; artist_id: string
  title: string; service_type: string; brief: string; status: StudioProjectStatus
  active_agreement_id: string | null; created_at: string; updated_at: string
}
export interface StudioAgreementTerms {
  scope: string; deliverables: string; timeline: string; payment_terms: string
  rights: string; cancellation: string; total_minor: number; deposit_minor: number
  currency: 'GHS'; revision_rounds: number; project_title: string
  producer_id: string; artist_id: string; producer_name: string; artist_name: string; studio_name: string
  milestones: { title: string; due_date: string | null }[]
}
export interface StudioAgreement {
  id: string; project_id: string; version: number
  status: 'SENT' | 'ACCEPTED' | 'CHANGES_REQUESTED' | 'SUPERSEDED'
  terms: StudioAgreementTerms; content_hash: string
  producer_accepted_at: string; artist_accepted_at: string | null
  changes_requested: string | null; created_at: string
}
export interface StudioEvent {
  id: string; project_id: string; actor_id: string; kind: string; body: string
  agreement_id: string | null; created_at: string
}
export interface StudioMilestone {
  id: string; project_id: string; title: string; due_date: string | null; completed_at: string | null
}
