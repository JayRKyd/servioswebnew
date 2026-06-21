'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

export default function ReviewsPage() {
  return <Suspense fallback={null}><ReviewsPageInner /></Suspense>
}
function ReviewsPageInner() {
  const { customerId } = useProfileIds()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const prefillBookingId = searchParams.get('booking')
  const [completedBookings, setCompletedBookings] = useState<any[]>([])
  const [selectedBooking, setSelectedBooking] = useState(prefillBookingId ?? '')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [existing, setExisting] = useState<any[]>([])

  useEffect(() => {
    if (!customerId || !user) return
    Promise.all([
      supabase.from('bookings').select('*, service:services(title)').eq('customer_id', customerId).eq('status', 'completed'),
      supabase.from('reviews').select('*, bookings(booking_number, scheduled_date, service:services(title))').eq('reviewer_id', user.id).order('created_at', { ascending: false }),
    ]).then(([{ data: b }, { data: r }]) => {
      setCompletedBookings(b ?? [])
      setExisting(r ?? [])
    })
  }, [customerId, user?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedBooking) return
    setSubmitting(true)
    await supabase.from('reviews').insert({ booking_id: selectedBooking, reviewer_id: user.id, rating, comment })
    setSuccess(true)
    setSubmitting(false)
    setComment('')
    setRating(5)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <h2 className="font-semibold text-gray-900">Leave a Review</h2>
        {success ? (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">Thank you for your review!</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking</label>
              <select required value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select a booking…</option>
                {completedBookings.map(b => <option key={b.id} value={b.id}>{b.service?.title ?? 'Booking'} · {formatDate(b.scheduled_date)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)}
                    className={'text-2xl transition ' + (n <= rating ? 'text-yellow-400' : 'text-gray-300')}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
              <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} required
                placeholder="Describe your experience…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </form>
        )}
      </div>

      {existing.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Your Reviews</h2>
          <div className="space-y-3">
            {existing.map(r => (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{r.bookings?.service?.title ?? r.bookings?.booking_number}</p>
                  <span className="text-yellow-400">{'★'.repeat(r.rating)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{r.comment}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
