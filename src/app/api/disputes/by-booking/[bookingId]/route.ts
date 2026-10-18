import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase } from '@/server/db/client'
import { loadBookingParties, disputeEligibility } from '@/server/lib/disputes'
import { loadDisputeView } from '@/server/lib/dispute-views'

export const dynamic = 'force-dynamic'

/** The latest dispute on a booking as the signed-in party sees it, plus
 *  (for the customer) whether a new one can be opened. */
export const GET = withUser<{ params: Promise<{ bookingId: string }> }>(async ({ user, ctx }) => {
  const { bookingId } = await ctx.params
  const parties = await loadBookingParties(bookingId)
  if (!parties) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const viewer = parties.customerUserId === user.id ? 'customer' : parties.providerUserId === user.id ? 'provider' : null
  if (!viewer) return NextResponse.json({ error: 'Not your booking' }, { status: 403 })

  const { data: latest } = await supabase
    .from('disputes').select('id').eq('booking_id', bookingId).neq('source', 'chargeback')
    .order('filed_at', { ascending: false }).limit(1).maybeSingle()
  const view = latest ? await loadDisputeView(latest.id, viewer) : null
  const eligibility = viewer === 'customer' ? await disputeEligibility(bookingId, user.id) : null
  return NextResponse.json({ viewer, view, eligibility })
})
