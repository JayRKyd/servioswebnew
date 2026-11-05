import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/auth-server'
import { supabase as db } from '@/server/db/client'
import { loadBookingParties } from '@/server/lib/disputes'

export const dynamic = 'force-dynamic'

/** Email "Message" links land here: find or create the booking's chat for
 *  whichever party is signed in, then redirect into it. Before this, links
 *  fell back to the booking page whenever nobody had messaged yet. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const url = new URL(req.url)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent(url.pathname)}`, url.origin))
  }

  const parties = await loadBookingParties(id)
  if (!parties) return NextResponse.redirect(new URL('/messages', url.origin))
  const isCustomer = parties.customerUserId === user.id
  const isProvider = parties.providerUserId === user.id
  if (!isCustomer && !isProvider) return NextResponse.redirect(new URL('/messages', url.origin))

  const { data: existing } = await db.from('conversations').select('id').eq('booking_id', id).maybeSingle()
  if (existing) return NextResponse.redirect(new URL(`/messages/${existing.id}`, url.origin))

  if (!parties.customerUserId || !parties.providerUserId) {
    return NextResponse.redirect(new URL(isProvider ? `/provider/bookings/${id}` : `/bookings/${id}`, url.origin))
  }
  const { data: conv, error } = await db.from('conversations').insert({
    booking_id: id,
    customer_id: parties.customerUserId,
    provider_id: parties.providerUserId,
    conversation_type: 'booking',
    status: 'active',
  }).select('id').single()
  if (error || !conv) {
    console.error('for-booking conversation create failed:', error)
    return NextResponse.redirect(new URL(isProvider ? `/provider/bookings/${id}` : `/bookings/${id}`, url.origin))
  }
  return NextResponse.redirect(new URL(`/messages/${conv.id}`, url.origin))
}
