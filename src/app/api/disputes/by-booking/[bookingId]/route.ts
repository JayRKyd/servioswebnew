import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase } from '@/server/db/client'
import { loadBookingParties, disputeEligibility, disputeDeadlineFor, OPEN_STATUSES } from '@/server/lib/disputes'
import { loadDisputeView } from '@/server/lib/dispute-views'
import { latestPaymentForBooking } from '@/server/lib/payments'
import { getSettings } from '@/server/lib/settings'

export const dynamic = 'force-dynamic'

/** The latest dispute on a booking as the signed-in party sees it, plus
 *  (for the customer) whether a new one can be opened, the payment state
 *  (so the UI never promises to "hold" money that was never taken) and the
 *  reporting window. */
export const GET = withUser<{ params: Promise<{ bookingId: string }> }>(async ({ user, ctx }) => {
  const { bookingId } = await ctx.params
  const parties = await loadBookingParties(bookingId)
  if (!parties) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const viewer = parties.customerUserId === user.id ? 'customer' : parties.providerUserId === user.id ? 'provider' : null
  if (!viewer) return NextResponse.json({ error: 'Not your booking' }, { status: 403 })

  const [{ data: cases }, payment, settings] = await Promise.all([
    supabase.from('disputes').select('id, status, source').eq('booking_id', bookingId)
      .order('filed_at', { ascending: false }).limit(20),
    latestPaymentForBooking(bookingId),
    getSettings(),
  ])
  // A chargeback is between Servios, the provider and the bank: the provider
  // sees it (their payout is held and they can add evidence), the customer
  // doesn't. An open case wins over a newer closed one.
  const mine = (cases ?? []).filter(c => viewer === 'provider' || c.source !== 'chargeback')
  const latest = mine.find(c => (OPEN_STATUSES as readonly string[]).includes(c.status)) ?? mine[0] ?? null
  const view = latest ? await loadDisputeView(latest.id, viewer) : null
  const eligibility = viewer === 'customer' ? await disputeEligibility(bookingId, user.id) : null

  const ps = payment?.payment_status ?? 'none'
  const paymentState = ['succeeded', 'partially_refunded', 'refunded'].includes(ps) ? 'paid'
    : ps === 'authorized' ? 'authorized' : 'none'
  // Stamped on the booking at confirmation — a later change to the setting
  // doesn't move it
  const window = await disputeDeadlineFor(bookingId, parties.booking.customer_confirmed_at)
  const windowEndsAt = window ? window.deadline.toISOString() : null

  const paidPence = paymentState === 'none' ? 0 : Number(payment?.amount ?? 0)
  const refundedPence = Number(payment?.refund_amount ?? 0)
  return NextResponse.json({
    viewer, view, eligibility, paymentState, windowEndsAt, windowDays: window?.windowDays ?? settings.dispute_window_days,
    // What can still be claimed / what the provider now stands to receive
    remainingPence: payment ? Math.max(0, Number(payment.amount) - refundedPence) : Number(parties.booking.total_amount),
    paidPence, refundedPence,
  })
})
