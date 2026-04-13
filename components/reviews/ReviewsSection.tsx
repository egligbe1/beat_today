'use client'

import { useEffect, useState } from 'react'
import { Star, Loader2, ThumbsUp } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer: {
    display_name: string
    avatar_url: string | null
    handle: string
  }
}

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => {
            if (!readonly && onChange) {
              console.log('Star clicked:', star)
              onChange(star)
            }
          }}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          disabled={readonly}
          className={cn(
            "p-1.5 rounded-lg transition-all duration-200",
            !readonly && "hover:bg-white/5 active:scale-90 cursor-pointer",
            readonly && "cursor-default"
          )}
        >
          <Star
            className={cn(
              "w-6 h-6 transition-all",
              star <= (hovered || value)
                ? 'text-accent-gold fill-accent-gold scale-110'
                : 'text-text-muted hover:text-white/40'
            )}
          />
        </button>
      ))}
    </div>
  )
}

import { showToast } from '@/lib/utils/toast'

export default function ReviewsSection({ beatId }: { beatId: string }) {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [hasPurchased, setHasPurchased] = useState(false)
  const [existingReview, setExistingReview] = useState<Review | null>(null)

  // Form state
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    async function load() {
      // Load reviews
      const res = await fetch(`/api/reviews?beat_id=${beatId}`)
      const data = await res.json()
      setReviews(data.reviews || [])
      setAvgRating(data.avg_rating)
      setTotal(data.total || 0)

      // Check auth
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (authUser) {
        // Check if user purchased this beat
        const { data: purchase } = await supabase
          .from('order_items')
          .select('id, orders!inner(buyer_id, status)')
          .eq('beat_id', beatId)
          .eq('orders.buyer_id', authUser.id)
          .eq('orders.status', 'completed')
          .limit(1)
          .maybeSingle()

        setHasPurchased(!!purchase)

        const existing = data.reviews?.find((r: any) => r.reviewer_id === authUser.id)
        if (existing) {
          setExistingReview(existing)
          setRating(existing.rating)
          setComment(existing.comment || '')
        }
        // Re-fetch to check user's own review
        const { data: myReview } = await supabase
          .from('beat_reviews')
          .select('*')
          .eq('beat_id', beatId)
          .eq('reviewer_id', authUser.id)
          .maybeSingle()

        if (myReview) {
          setExistingReview(myReview as any)
          setRating(myReview.rating)
          setComment(myReview.comment || '')
        }
      }

      setLoading(false)
    }
    load()
  }, [beatId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rating) return
    setSubmitting(true)

    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beat_id: beatId, rating, comment })
    })

    const data = await res.json()
    setSubmitting(false)

    if (res.ok) {
      // Refresh reviews
      const res2 = await fetch(`/api/reviews?beat_id=${beatId}`)
      const refreshed = await res2.json()
      setReviews(refreshed.reviews || [])
      setAvgRating(refreshed.avg_rating)
      setTotal(refreshed.total || 0)
      setExistingReview(data.review)
      setShowForm(false)
      showToast.success('Review submitted!')
    } else {
      showToast.error(data.error || 'Failed to submit review')
    }
  }

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: total > 0 ? (reviews.filter(r => r.rating === star).length / total) * 100 : 0
  }))

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-text-muted" /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Summary */}
        <div className="bg-bg-surface p-6 rounded-2xl border border-border-subtle min-w-[200px] text-center space-y-3">
          <p className="text-6xl font-black text-white">
            {avgRating ? avgRating.toFixed(1) : '—'}
          </p>
          <StarRating value={Math.round(avgRating || 0)} readonly />
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{total} review{total !== 1 ? 's' : ''}</p>
        </div>

        {/* Distribution */}
        <div className="flex-1 space-y-2">
          {ratingDistribution.map(({ star, count, pct }) => (
            <div key={star} className="flex items-center gap-3 text-xs">
              <span className="w-3 text-text-muted font-bold text-right">{star}</span>
              <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold flex-shrink-0" />
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-gold to-accent-orange rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-text-muted text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Write review CTA */}
      {user && hasPurchased && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-3 bg-accent-orange/10 border border-accent-orange/20 text-accent-orange text-sm font-bold rounded-xl hover:bg-accent-orange/20 transition-all"
        >
          <ThumbsUp className="w-4 h-4" />
          {existingReview ? 'Edit Your Review' : 'Write a Review'}
        </button>
      )}

      {/* Review form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-surface p-6 rounded-2xl border border-border-subtle space-y-4">
          <h3 className="font-bold text-white">Your Review</h3>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Comment (Optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder="How was this beat? Did it fit your project?"
              className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent-orange resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!rating || submitting}
              className="px-6 h-11 bg-accent-orange text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {existingReview ? 'Update Review' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 h-11 bg-bg-primary border border-border-subtle text-text-muted rounded-xl font-bold text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Review list */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-center text-text-muted py-8 text-sm">No reviews yet. Be the first to review this beat!</p>
        ) : (
          reviews.map(review => (
            <div key={review.id} className="bg-bg-surface p-5 rounded-2xl border border-border-subtle space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated relative">
                  {review.reviewer?.avatar_url ? (
                    <Image src={review.reviewer.avatar_url} alt={review.reviewer.display_name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted bg-white/5">
                      {review.reviewer?.display_name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{review.reviewer?.display_name || 'Anonymous'}</p>
                  <p className="text-[10px] text-text-muted">{new Date(review.created_at).toLocaleDateString()}</p>
                </div>
                <div className="ml-auto">
                  <StarRating value={review.rating} readonly />
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-text-muted leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
