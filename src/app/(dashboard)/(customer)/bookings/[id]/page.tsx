'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { apiClient } from '@/lib/api-client'
import { formatDate, formatCurrency, formatTime } from '@/lib/utils'
import { BookingPhotos } from '@/components/shared/BookingPhotos'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Lock, CheckCircle, Shield, AlertTriangle, MessageCircle } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)


function ReviewModal({ bookingId, revieweeId, onClose }: { bookingId: string; revieweeId?: string | null; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (rating === 0) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('reviews').insert({
      booking_id: bookingId,
      reviewer_id: user?.id,
      reviewee_id: revieweeId ?? null,
      rating,
      review_text: comment || null,
    })
    setDone(true)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        {done ? (
          <>
            <div className="text-center text-4xl">🎉</div>
            <h2 className="text-center text-lg font-bold text-gray-900">Review submitted!</h2>
            <p className="text-center text-sm text-gray-500">Thank you for your feedback.</p>
            <button onClick={onClose} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">Close</button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900">Leave a review</h2>
            <p className="text-sm text-gray-500">How was the service?</p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} className="text-3xl">
                  <span className={n <= rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your experience (optional)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Skip</button>
              <button
                onClick={submit}
                disabled={rating === 0 || submitting}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ClaimModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (description.trim().length < 10) { setError('Please provide at least 10 characters describing the issue.'); return }
    setSubmitting(true); setError(null)
    const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').single()
    const { error: err } = await supabase.from('claims').insert({ booking_id: bookingId, customer_id: cp?.id ?? null, description: description.trim() })
    if (err) { setError(err.message) } else { setDone(true) }
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        {done ? (
          <>
            <div className="text-center text-4xl">📋</div>
            <h2 className="text-center text-lg font-bold text-gray-900">Claim submitted</h2>
            <p className="text-center text-sm text-gray-500">Our team will review your workmanship claim and follow up within 3–5 business days.</p>
            <button onClick={onClose} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">Close</button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-bold text-gray-900">File a Workmanship Claim</h2>
              <p className="text-sm text-gray-500 mt-1">Claims can be filed within 90 days of job completion.</p>
            </div>
            <textarea rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue with the work done. Be specific about what was not completed correctly or needs to be redone."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 rounded-lg bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Claim'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CustomerBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [showClaim, setShowClaim] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('bookings')
        .select('*, service:services(title), provider_profile:provider_profiles(id, user_id, first_name, last_name, business_name, profile_image_url), customer_profile:customer_profiles(id, user_id)')
        .eq('id', id).single(),
      supabase.from('payments')
        .select('id, status, amount, captured_at, paid_at')
        .eq('booking_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      setBooking(b)
      setPayment(p)
      setLoading(false)
    })
  }, [id])

  async function handlePay() {
    if (!booking) return
    setPaying(true)
    setPayError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const { data, error } = await apiClient('/api/v1/payments/intent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      if (error) {
        setPayError(error ?? 'Failed to create payment. Please try again.')
        setPaying(false)
        return
      }
      // Simulation mode — no Stripe keys configured, payment held in DB directly
      if (data?.simulated) {
        setPayment((p: any) => ({ ...p, status: 'authorized' }))
        setPaying(false)
        return
      }
      if (!data?.clientSecret) {
        setPayError('Failed to create payment. Please try again.')
        setPaying(false)
        return
      }
      const stripe = await stripePromise
      if (!stripe) { setPayError('Stripe failed to load.'); setPaying(false); return }
      const result = await stripe.confirmCardPayment(data.clientSecret)
      if (result.error) {
        setPayError(result.error.message ?? 'Payment failed.')
      } else {
        setPayment((p: any) => ({ ...p, status: 'authorized' }))
      }
    } catch (e: any) {
      setPayError(e.message ?? 'Unexpected error.')
    }
    setPaying(false)
  }

  async function handleConfirmComplete() {
    if (!confirm('Confirm the job is complete? This will release payment to the provider.')) return
    setConfirming(true)

    const { error } = await supabase.from('bookings').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
    if (error) { setConfirming(false); return }

    setBooking((b: any) => ({ ...b, status: 'completed' }))

    // Trigger payment capture if a payment is held
    if (payment?.id && payment.status === 'authorized') {
      const { data: captured } = await apiClient(`/api/v1/payments/capture/${payment.id}`, { method: 'POST' })
      if (captured) setPayment((p: any) => ({ ...p, status: 'succeeded', captured_at: new Date().toISOString() }))
    }

    // Notify provider
    if (booking?.provider_profile?.user_id) {
      await supabase.from('notifications').insert({
        user_id: booking.provider_profile.user_id,
        notification_type: 'booking_completed',
        title: 'Job confirmed complete',
        body: `Customer confirmed booking #${booking.booking_number} is complete. Payment will be released.`,
        data: { booking_id: id },
      })
    }

    setConfirming(false)
    setShowReview(true)
  }

  async function handleOpenMessage() {
    if (!booking) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const customerId = booking.customer_profile?.id
    const providerId = booking.provider_profile?.id
    if (!customerId || !providerId) return
    // Find or create conversation linked to this booking
    const { data: existing } = await supabase.from('conversations').select('id').eq('booking_id', id).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: conv } = await supabase.from('conversations').insert({
      booking_id: id, customer_id: customerId, provider_id: providerId, conversation_type: 'booking', status: 'active',
    }).select('id').single()
    if (conv) router.push(`/messages/${conv.id}`)
  }

  async function handleCancel() {
    if (!confirm('Cancel this booking?')) return
    setCancelling(true)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    router.refresh()
    setBooking((b: any) => ({ ...b, status: 'cancelled' }))
    setCancelling(false)
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="text-gray-400">Loading…</div></div>
  if (!booking) return <div className="text-gray-400">Booking not found.</div>

  const canConfirm = ['in_progress', 'accepted'].includes(booking.status)
  const canCancel = ['pending', 'accepted'].includes(booking.status)
  const canReview = booking.status === 'completed'
  const canClaim = booking.status === 'completed' && (() => {
    if (!booking.completed_at) return true
    const days = (Date.now() - new Date(booking.completed_at).getTime()) / (1000 * 60 * 60 * 24)
    return days <= 90
  })()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {showReview && (
        <ReviewModal
          bookingId={id as string}
          revieweeId={booking?.provider_id ?? null}
          onClose={() => setShowReview(false)}
        />
      )}
      {showClaim && (
        <ClaimModal
          bookingId={id as string}
          onClose={() => setShowClaim(false)}
        />
      )}

      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="mt-1 text-sm text-primary hover:underline">← Back</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {booking.service?.title ?? 'Booking'}
            {booking.provider_profile ? ` — ${booking.provider_profile.business_name ?? booking.provider_profile.first_name}` : ''}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Job &quot;{booking.service?.title ?? 'Booking'}&quot;</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status</span>
          <StatusBadge status={booking.status} />
        </div>
        {booking.service?.title && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Service</span>
            <span className="text-sm font-medium">{booking.service.title}</span>
          </div>
        )}
        {booking.provider_profile && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Provider</span>
            <div className="flex items-center gap-2">
              {booking.provider_profile.profile_image_url ? (
                <img src={booking.provider_profile.profile_image_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                  {(booking.provider_profile.first_name?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">
                {booking.provider_profile.business_name || `${booking.provider_profile.first_name} ${booking.provider_profile.last_name}`}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Date</span>
          <span className="text-sm font-medium">{formatDate(booking.scheduled_date)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Time</span>
          <span className="text-sm font-medium">{formatTime(booking.scheduled_time_start)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Amount</span>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(booking.total_amount / 100)}</span>
        </div>
        {booking.is_emergency && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">🚨 Emergency booking — 15% commission applies</div>
        )}
        {/* Payment status panel — driven by real payments row */}
        {booking.total_amount > 0 && (
          <div className="border-t pt-4">
            {(() => {
              const ps = payment?.status
              // Captured / released
              if (ps === 'succeeded' || booking.status === 'completed') {
                const netCents = (booking.total_amount ?? 0) - (booking.platform_fee ?? 0)
                return (
                  <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
                    <span className="text-lg">✓</span>
                    <div>
                      <p className="text-[13px] font-semibold text-green-900">Payment released</p>
                      <p className="text-[12px] text-green-700 mt-0.5">
                        {formatCurrency(netCents / 100)} sent to provider
                        {booking.platform_fee ? ` · ${formatCurrency(booking.platform_fee / 100)} platform fee (${booking.commission_rate ?? 12}%)` : ''}
                      </p>
                    </div>
                  </div>
                )
              }
              // Held / authorized
              if (ps === 'authorized') {
                return (
                  <div className="rounded-lg bg-primary/[0.06] border border-primary/20 px-4 py-3 flex items-start gap-3">
                    <span className="text-lg">🔒</span>
                    <div>
                      <p className="text-[13px] font-semibold text-primary">Payment held in escrow</p>
                      <p className="text-[12px] text-primary/70 mt-0.5">
                        {formatCurrency(booking.total_amount / 100)} is secured. Confirm the job is complete to release it to your provider.
                      </p>
                    </div>
                  </div>
                )
              }
              // Failed
              if (ps === 'failed') {
                return (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
                    <span className="text-lg">⚠</span>
                    <div>
                      <p className="text-[13px] font-semibold text-red-800">Payment failed</p>
                      <p className="text-[12px] text-red-700 mt-0.5">There was a problem processing your payment. Please contact support.</p>
                    </div>
                  </div>
                )
              }
              // Refunded
              if (ps === 'refunded' || ps === 'cancelled') {
                return (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-start gap-3">
                    <span className="text-lg">↩</span>
                    <div>
                      <p className="text-[13px] font-semibold text-gray-700">Payment refunded</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">{formatCurrency(booking.total_amount / 100)} has been returned.</p>
                    </div>
                  </div>
                )
              }
              // Awaiting payment (no payment row yet)
              if (['pending', 'accepted', 'in_progress'].includes(booking.status)) {
                return (
                  <div className="rounded-lg bg-[#fafbfa] border border-border px-4 py-3 flex items-start gap-3">
                    <span className="text-lg">⏳</span>
                    <div>
                      <p className="text-[13px] font-semibold text-dark">Awaiting payment</p>
                      <p className="text-[12px] text-muted mt-0.5">{formatCurrency(booking.total_amount / 100)} will be collected before work begins.</p>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>
        )}
        {booking.customer_notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">Your notes</p>
            <p className="text-sm text-gray-700">{booking.customer_notes}</p>
          </div>
        )}
        {booking.provider_notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">Provider notes</p>
            <p className="text-sm text-gray-700">{booking.provider_notes}</p>
          </div>
        )}
      </div>

      <BookingPhotos
        bookingId={id as string}
        bookingStatus={booking.status}
        isProvider={false}
      />

      {payError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{payError}</div>
      )}

      <div className="flex gap-3">
        {booking.status === 'accepted' && !payment && (
          <button onClick={handlePay} disabled={paying}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {paying ? 'Processing…' : <><Lock size={14} /> Pay £{(booking.total_amount / 100).toFixed(2)} securely</>}
          </button>
        )}
        {canConfirm && (
          <button onClick={handleConfirmComplete} disabled={confirming}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
            {confirming ? 'Confirming…' : <><CheckCircle size={14} /> Confirm Job Complete</>}
          </button>
        )}
        {canCancel && (
          <button onClick={handleCancel} disabled={cancelling}
            className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            {cancelling ? 'Cancelling…' : 'Cancel Booking'}
          </button>
        )}
        {canReview && (
          <button onClick={() => setShowReview(true)}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            Leave a Review
          </button>
        )}
        {['pending','accepted','in_progress'].includes(booking.status) && (
          <button onClick={handleOpenMessage}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <MessageCircle size={14} /> Message
          </button>
        )}
      </div>
      {canClaim && (
        <button onClick={() => setShowClaim(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50">
          <Shield size={14} /> File a Workmanship Claim
        </button>
      )}
    </div>
  )
}
