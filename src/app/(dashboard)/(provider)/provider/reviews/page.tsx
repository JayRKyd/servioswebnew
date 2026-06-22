'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

function relativeReviewDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30) return `${diff} days ago`
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`
  return `${Math.floor(diff / 365)} years ago`
}

export default function ProviderReviewsPage() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('reviews')
      .select('*, booking:bookings(service:services(title))')
      .eq('reviewee_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setReviews(data ?? []); setLoading(false) })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>

      {/* Summary */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 flex items-start gap-6">
        {reviews.length > 0 ? (
          <div className="text-center shrink-0">
            <p className="text-4xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
            <Stars rating={avgRating} />
            <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          </div>
        ) : (
          <div className="flex items-start gap-4 w-full">
            <div className="shrink-0 rounded-2xl bg-gray-50 p-4">
              <span className="text-3xl text-gray-200">★</span>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Not enough data yet</p>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                Reviews appear here after customers confirm a completed job.<br />
                Complete your first booking to start building your reputation.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Review list */}
      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map(r => {
            const initials = r.reviewer_name
              ? r.reviewer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              : '?'
            return (
              <div key={r.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{r.reviewer_name ?? 'Customer'}</p>
                      {r.booking?.service?.title && (
                        <p className="text-xs text-gray-400">{r.booking.service.title}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Stars rating={r.rating} />
                    <p className="text-xs text-gray-400 mt-0.5">{relativeReviewDate(r.created_at)}</p>
                  </div>
                </div>
                {r.review_text && (
                  <p className="text-sm text-gray-700 leading-relaxed">{r.review_text}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
