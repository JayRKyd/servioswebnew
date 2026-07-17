'use client'
import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Star, CheckCircle2, MessageSquareQuote } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, titleCase } from '@/lib/utils'

function providerName(p: any): string {
  if (!p) return 'your provider'
  return p.business_name?.trim() || `${titleCase(p.first_name ?? '')} ${titleCase(p.last_name ?? '')}`.trim() || 'your provider'
}

export default function ReviewsPage() {
  return <Suspense fallback={null}><ReviewsPageInner /></Suspense>
}

function ReviewsPageInner() {
  const { customerId } = useProfileIds()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const prefillBookingId = searchParams.get('booking')

  const [completedBookings, setCompletedBookings] = useState<any[]>([])
  const [existing, setExisting] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedBooking, setSelectedBooking] = useState(prefillBookingId ?? '')
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!customerId || !user) return
    const [{ data: b }, { data: r }] = await Promise.all([
      supabase.from('bookings')
        .select('id, scheduled_date, service:services(title), provider:provider_profiles(user_id, business_name, first_name, last_name)')
        .eq('customer_id', customerId)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: false }),
      supabase.from('reviews')
        .select('*, bookings(booking_number, scheduled_date, service:services(title), provider:provider_profiles(business_name, first_name, last_name))')
        .eq('reviewer_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    setCompletedBookings(b ?? [])
    setExisting(r ?? [])
    setLoading(false)
  }, [customerId, user?.id])

  useEffect(() => { load() }, [load])

  // Only bookings that have a provider and haven't been reviewed yet
  const reviewedBookingIds = new Set(existing.map(r => r.booking_id))
  const reviewableBookings = completedBookings.filter(
    b => b.provider?.user_id && !reviewedBookingIds.has(b.id)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedBooking) return
    setError(null)

    const booking = completedBookings.find(b => b.id === selectedBooking)
    if (!booking?.provider?.user_id) {
      setError('This booking has no provider attached, so it can’t be reviewed.')
      return
    }

    setSubmitting(true)
    const { error: insertError } = await supabase.from('reviews').insert({
      booking_id: selectedBooking,
      reviewer_id: user.id,
      reviewee_id: booking.provider.user_id,
      rating,
      review_text: reviewText.trim() || null,
    })

    if (insertError) {
      setSubmitting(false)
      if (insertError.code === '23505') {
        setError('You’ve already reviewed this booking.')
      } else {
        setError(insertError.message)
      }
      return
    }

    // Let the provider know
    await supabase.from('notifications').insert({
      user_id: booking.provider.user_id,
      notification_type: 'review_new',
      title: 'New review received',
      body: `You received a ${rating}-star review for ${booking.service?.title ?? 'a recent job'}.`,
      data: { booking_id: selectedBooking },
    })

    setSubmitting(false)
    setSuccess(true)
    setSelectedBooking('')
    setReviewText('')
    setRating(5)
    load()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">

        {/* ── Leave a review ── */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
          <h2 className="font-semibold text-gray-900">Leave a Review</h2>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                <CheckCircle2 size={17} className="shrink-0 text-green-600" />
                Thank you — your review has been published.
              </div>
              {reviewableBookings.length > 0 && (
                <button
                  onClick={() => setSuccess(false)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Review another booking
                </button>
              )}
            </div>
          ) : reviewableBookings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-50">
                <MessageSquareQuote size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {completedBookings.length > 0 ? 'All caught up' : 'Nothing to review yet'}
              </p>
              <p className="max-w-xs text-xs text-gray-500 leading-relaxed">
                {completedBookings.length > 0
                  ? 'You’ve reviewed all your completed bookings. New jobs will appear here once they’re done.'
                  : 'Once a booking is completed, you can rate your provider here — reviews help other customers choose with confidence.'}
              </p>
              {completedBookings.length === 0 && (
                <Link href="/book" className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
                  Book a service
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Booking</label>
                <select required value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select a booking…</option>
                  {reviewableBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.service?.title ?? 'Booking'} · {providerName(b.provider)} · {formatDate(b.scheduled_date)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <div className="flex gap-1.5" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                      className="transition-transform hover:scale-110">
                      <Star size={26}
                        className={n <= (hoverRating || rating)
                          ? 'fill-amber-400 stroke-amber-400'
                          : 'fill-gray-200 stroke-gray-200'} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your review</label>
                <textarea rows={4} value={reviewText} onChange={e => setReviewText(e.target.value)} required
                  placeholder="How was the work? Was the provider on time, tidy, good value?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button type="submit" disabled={submitting}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors">
                {submitting ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        {/* ── Your reviews ── */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Your Reviews</h2>
          {existing.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Reviews you leave for providers will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {existing.map(r => (
                <div key={r.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-gray-900">
                      {r.bookings?.service?.title ?? 'Booking'}
                      {r.bookings?.provider && (
                        <span className="font-normal text-gray-500"> · {providerName(r.bookings.provider)}</span>
                      )}
                    </p>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={13}
                          className={n <= r.rating ? 'fill-amber-400 stroke-amber-400' : 'fill-gray-200 stroke-gray-200'} />
                      ))}
                    </span>
                  </div>
                  {r.review_text && <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{r.review_text}</p>}
                  <p className="mt-1.5 text-xs text-gray-400">{formatDate(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
