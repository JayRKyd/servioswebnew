'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

const FLAG_REASONS = [
  'Not related to my work',
  'Contains false information',
  'Violates Servios guidelines',
  'Was submitted by mistake',
  'Other',
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`text-base ${n <= rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

interface Review {
  id: string
  booking_id: string
  reviewer_id: string
  rating: number
  review_text: string | null
  response_text: string | null
  responded_at: string | null
  is_flagged: boolean
  flag_reason: string | null
  created_at: string
  reviewer?: { first_name: string; last_name: string } | null
}

export default function ProviderReviewsPage() {
  const { providerId } = useProfileIds()
  const [reviews, setReviews] = useState<Review[]>([])
  const [profile, setProfile] = useState<{ rating_average: number; total_reviews: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replySaving, setReplySaving] = useState<string | null>(null)
  const [flagOpen, setFlagOpen] = useState<string | null>(null)
  const [flagReason, setFlagReason] = useState<Record<string, string>>({})
  const [flagSaving, setFlagSaving] = useState<string | null>(null)

  useEffect(() => {
    if (!providerId) {
      setLoading(false)
      return
    }

    async function load() {
      const [{ data: rev }, { data: prof }] = await Promise.all([
        supabase
          .from('reviews')
          .select('*')
          .eq('reviewee_id', providerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('provider_profiles')
          .select('rating_average, total_reviews')
          .eq('id', providerId)
          .single(),
      ])

      const reviewList: Review[] = rev ?? []

      // Fetch reviewer names
      if (reviewList.length > 0) {
        const reviewerIds = [...new Set(reviewList.map(r => r.reviewer_id).filter(Boolean))]
        const { data: customers } = await supabase
          .from('customer_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', reviewerIds)

        const customerMap = Object.fromEntries((customers ?? []).map(c => [c.user_id, c]))
        reviewList.forEach(r => {
          (r as any).reviewer = customerMap[r.reviewer_id] ?? null
        })
      }

      setReviews(reviewList)
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [providerId])

  async function submitReply(reviewId: string) {
    const text = replyText[reviewId]?.trim()
    if (!text) return
    setReplySaving(reviewId)
    await supabase
      .from('reviews')
      .update({ response_text: text, responded_at: new Date().toISOString() })
      .eq('id', reviewId)
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, response_text: text, responded_at: new Date().toISOString() } : r))
    setReplyOpen(null)
    setReplySaving(null)
  }

  async function submitFlag(reviewId: string) {
    const reason = flagReason[reviewId]
    if (!reason) return
    setFlagSaving(reviewId)
    await supabase
      .from('reviews')
      .update({ is_flagged: true, flag_reason: reason })
      .eq('id', reviewId)
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, is_flagged: true, flag_reason: reason } : r))
    setFlagOpen(null)
    setFlagSaving(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm text-gray-500">Average Rating</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{profile?.rating_average?.toFixed(1) ?? '—'}</p>
            {profile?.rating_average && <StarRating rating={Math.round(profile.rating_average)} />}
          </div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm text-gray-500">Total Reviews</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{profile?.total_reviews ?? reviews.length}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 col-span-2 sm:col-span-1">
          <p className="text-sm text-gray-500">Response Rate</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {reviews.length > 0
              ? `${Math.round((reviews.filter(r => r.response_text).length / reviews.length) * 100)}%`
              : '—'}
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => {
            const reviewer = (review as any).reviewer
            const reviewerName = reviewer ? `${reviewer.first_name} ${reviewer.last_name}`.trim() : 'Customer'
            const isReplyOpen = replyOpen === review.id
            const isFlagOpen = flagOpen === review.id

            return (
              <div key={review.id} className={`rounded-xl bg-white shadow-sm ring-1 p-5 space-y-3 ${review.is_flagged ? 'ring-amber-200 bg-amber-50' : 'ring-gray-100'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{reviewerName}</p>
                      <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                      {review.is_flagged && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Flagged</span>
                      )}
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                </div>

                {review.review_text && (
                  <p className="text-sm text-gray-700">{review.review_text}</p>
                )}

                {/* Provider reply bubble */}
                {review.response_text && (
                  <div className="ml-4 rounded-lg border-l-4 border-primary/40 bg-primary/[0.04] px-4 py-3">
                    <p className="text-xs font-medium text-primary mb-1">Your reply · {formatDate(review.responded_at!)}</p>
                    <p className="text-sm text-gray-700">{review.response_text}</p>
                  </div>
                )}

                {/* Actions */}
                {!review.is_flagged && (
                  <div className="flex items-center gap-4 pt-1">
                    {!review.response_text && (
                      <button
                        onClick={() => setReplyOpen(isReplyOpen ? null : review.id)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {isReplyOpen ? 'Cancel' : 'Reply'}
                      </button>
                    )}
                    {review.response_text && (
                      <button
                        onClick={() => {
                          setReplyText(prev => ({ ...prev, [review.id]: review.response_text! }))
                          setReplyOpen(isReplyOpen ? null : review.id)
                        }}
                        className="text-xs font-medium text-gray-500 hover:underline"
                      >
                        {isReplyOpen ? 'Cancel' : 'Edit reply'}
                      </button>
                    )}
                    <button
                      onClick={() => setFlagOpen(isFlagOpen ? null : review.id)}
                      className="text-xs font-medium text-gray-400 hover:text-amber-600 hover:underline"
                    >
                      {isFlagOpen ? 'Cancel' : 'Flag as unfair'}
                    </button>
                  </div>
                )}

                {/* Reply form */}
                {isReplyOpen && (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={replyText[review.id] ?? ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [review.id]: e.target.value }))}
                      placeholder="Write a professional response visible to all customers…"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => submitReply(review.id)}
                      disabled={!replyText[review.id]?.trim() || replySaving === review.id}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      {replySaving === review.id ? 'Saving…' : 'Post reply'}
                    </button>
                  </div>
                )}

                {/* Flag form */}
                {isFlagOpen && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Why are you flagging this review?</p>
                    <div className="space-y-1">
                      {FLAG_REASONS.map(reason => (
                        <label key={reason} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name={`flag-${review.id}`}
                            value={reason}
                            checked={flagReason[review.id] === reason}
                            onChange={() => setFlagReason(prev => ({ ...prev, [review.id]: reason }))}
                            className="accent-primary"
                          />
                          {reason}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => submitFlag(review.id)}
                      disabled={!flagReason[review.id] || flagSaving === review.id}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {flagSaving === review.id ? 'Submitting…' : 'Submit flag for review'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
