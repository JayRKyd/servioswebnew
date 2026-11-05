import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase as db } from '@/server/db/client'
import { loadBookingParties } from '@/server/lib/disputes'
import { sendEmail } from '@/server/lib/notifications'
import { renderNotificationEmail, escapeHtml, ukDate, ukTime, poundsFromCents } from '@/server/lib/email-templates'

/** Provider asks the customer to authorise payment so work can start.
 *  Rate-limited to one nudge per booking per 12 hours. */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async ({ user, ctx }) => {
  const { id } = await ctx.params
  const parties = await loadBookingParties(id)
  if (!parties) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (parties.providerUserId !== user.id) return NextResponse.json({ error: 'Only the provider can send this' }, { status: 403 })
  const { booking } = parties
  if (!parties.customerUserId) return NextResponse.json({ error: 'This booking has no customer' }, { status: 400 })

  const { data: b } = await db.from('bookings').select('payment_status, scheduled_time_start, service:services(title), admin_notes').eq('id', id).maybeSingle()
  if (['authorized', 'paid', 'partially_refunded'].includes(b?.payment_status ?? '')) {
    return NextResponse.json({ error: 'The customer has already authorised payment' }, { status: 409 })
  }

  const { data: recent } = await db.from('notifications')
    .select('created_at').eq('user_id', parties.customerUserId).eq('notification_type', 'payment_nudge')
    .contains('data', { booking_id: id }).gte('created_at', new Date(Date.now() - 12 * 3600_000).toISOString()).limit(1)
  if (recent && recent.length > 0) return NextResponse.json({ error: 'You already asked in the last 12 hours — give them a little time' }, { status: 429 })

  const { data: pp } = await db.from('provider_profiles').select('business_name, first_name, last_name').eq('id', booking.provider_id!).maybeSingle()
  const providerName = pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'Your provider'
  const service = (b?.service as any)?.title ?? 'your booking'
  const amount = poundsFromCents(Number(booking.total_amount))
  const when = booking.scheduled_date ? `${ukDate(booking.scheduled_date)}, ${ukTime(b?.scheduled_time_start)}` : ''

  await db.from('notifications').insert({
    user_id: parties.customerUserId,
    notification_type: 'payment_nudge',
    title: `Authorise ${amount} for ${service}`,
    body: `${providerName} is ready to go but can't start until your card is authorised. Nothing is charged until you confirm the job.`,
    data: { booking_id: id },
  })
  const { data: u } = await db.auth.admin.getUserById(parties.customerUserId)
  if (u?.user?.email) {
    await sendEmail(u.user.email, `Action needed: authorise ${amount} for ${service}`, renderNotificationEmail({
      heading: 'Your provider is ready — payment needed',
      body: `${escapeHtml(providerName)} can't start work on this job until ${amount} is authorised on your card. It's only a hold: nothing is charged until you confirm the work is done.`,
      details: [
        { label: 'Service', value: escapeHtml(service) },
        ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
        { label: 'Amount to authorise', value: amount },
        ...(booking.booking_number ? [{ label: 'Reference', value: escapeHtml(String(booking.booking_number)) }] : []),
      ],
      ctaLabel: `Authorise ${amount}`,
      ctaPath: `/bookings/${id}`,
      secondaryCtas: [{ label: 'Message provider', path: `/messages/for-booking/${id}` }],
      preheader: `${providerName} is waiting on your payment authorisation`,
    }))
  }
  return NextResponse.json({ ok: true })
})
