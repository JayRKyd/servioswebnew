import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase } from '@/server/db/client'
import { loadBookingParties, disputeEligibility } from '@/server/lib/disputes'
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

  const [{ data: latest }, payment, settings] = await Promise.all([
    supabase.from('disputes').select('id').eq('booking_id', bookingId).neq('source', 'chargeback')
      .order('filed_at', { ascending: false }).limit(1).maybeSingle(),
    latestPaymentForBooking(bookingId),
    getSettings(),
  ])
  const view = latest ? await loadDisputeView(latest.id, viewer) : null
  const eligibility = viewer === 'customer' ? await disputeEligibility(bookingId, user.id) : null

  const ps = payment?.payment_status ?? 'none'
  const paymentState = ['succeeded', 'partially_refunded', 'refunded'].includes(ps) ? 'paid'
    : ps === 'authorized' ? 'authorized' : 'none'
  const windowEndsAt = parties.booking.customer_confirmed_at
    ? new Date(new Date(parties.booking.customer_confirmed_at).getTime() + settings.dispute_window_days * 86_400_000).toISOString()
    : null

  return NextResponse.json({ viewer, view, eligibility, paymentState, windowEndsAt, windowDays: settings.dispute_window_days })
})
