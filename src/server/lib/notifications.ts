import { supabase } from '../db/client'

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // TODO: integrate SendGrid / Resend
  console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
}

export async function sendSMS(to: string, body: string): Promise<void> {
  // TODO: integrate Twilio
  console.log(`[SMS] To: ${to} | Body: ${body}`)
}

/**
 * Send push notification via Expo Push API.
 * Looks up all registered Expo tokens for the user.
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const { data: rows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'expo')

  if (!rows || rows.length === 0) return

  const messages = rows.map((r: { token: string }) => ({
    to: r.token,
    sound: 'default',
    title,
    body,
    data: data ?? {},
  }))

  // Expo Push API — no SDK required, plain HTTP
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })

  if (!res.ok) {
    console.error('[PUSH] Expo Push API error:', await res.text())
  }
}

/**
 * Notify booking parties when status changes.
 */
export async function notifyBookingUpdate(
  bookingId: string,
  newStatus: string,
  changedByUserId: string
): Promise<void> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, provider_id, landlord_id, booking_number')
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const messages: Record<string, { title: string; body: string }> = {
    accepted:    { title: 'Booking Accepted',  body: `Booking ${booking.booking_number} has been accepted.` },
    rejected:    { title: 'Booking Rejected',  body: `Booking ${booking.booking_number} was not accepted.` },
    in_progress: { title: 'Job Started',       body: `Provider has started work on ${booking.booking_number}.` },
    completed:   { title: 'Job Completed',     body: `Booking ${booking.booking_number} is complete.` },
    cancelled:   { title: 'Booking Cancelled', body: `Booking ${booking.booking_number} was cancelled.` },
  }

  const msg = messages[newStatus]
  if (!msg) return

  const targets = [booking.customer_id, booking.provider_id, booking.landlord_id].filter(
    (id): id is string => Boolean(id) && id !== changedByUserId
  )

  await Promise.all(
    targets.map((uid) => sendPush(uid, msg.title, msg.body, { bookingId, screen: 'booking' }))
  )
}
