import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/server/lib/notifications'
import { renderNotificationEmail, greetingFor, escapeHtml, ukDate, ukTime, poundsFromCents, type EmailTone } from '@/server/lib/email-templates'
import { getVatNumber } from '@/server/lib/settings'
import { cancelHeldPayment } from '@/server/lib/payments'

/** Called by Postgres triggers (pg_net http_post) on bookings insert,
 *  bookings status change, and messages insert. Sends the transactional
 *  emails and in-app notifications that client-side inserts can't. */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, any>
  old_record: Record<string, any> | null
}

async function emailForUser(userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}

/** "Hi Priya," for whoever the email is going to. */
async function hi(userId: string | null | undefined): Promise<string | undefined> {
  if (!userId) return undefined
  const [{ data: pp }, { data: cp }] = await Promise.all([
    supabase.from('provider_profiles').select('first_name').eq('user_id', userId).maybeSingle(),
    supabase.from('customer_profiles').select('first_name').eq('user_id', userId).maybeSingle(),
  ])
  return greetingFor(pp?.first_name ?? cp?.first_name)
}

async function personFor(userId: string): Promise<{ name: string; avatarUrl: string | null; rating: number | null; ratingCount: number | null; meta?: string }> {
  const { data: pp } = await supabase
    .from('provider_profiles')
    .select('business_name, first_name, last_name, profile_image_url, rating_average, total_reviews')
    .eq('user_id', userId)
    .maybeSingle()
  if (pp) {
    return {
      name: pp.business_name?.trim() || `${pp.first_name ?? ''} ${pp.last_name ?? ''}`.trim() || 'A provider',
      avatarUrl: pp.profile_image_url ?? null,
      rating: Number(pp.rating_average) || null,
      ratingCount: pp.total_reviews ?? null,
    }
  }
  const { data: cp } = await supabase
    .from('customer_profiles')
    .select('first_name, last_name, profile_image_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (cp) {
    return {
      name: `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim() || 'A customer',
      avatarUrl: cp.profile_image_url ?? null,
      rating: null, ratingCount: null, meta: 'Customer',
    }
  }
  return { name: 'Someone', avatarUrl: null, rating: null, ratingCount: null }
}

async function notifyInApp(userId: string, type: string, title: string, body: string, data: Record<string, unknown>) {
  await supabase.from('notifications').insert({
    user_id: userId,
    notification_type: type,
    title,
    body,
    data,
  })
}

/** "Message" links open the booking's chat — the route finds or creates the
 *  conversation for whichever party clicks, so it works before anyone has
 *  written (client: links landed on the booking page instead) */
function conversationPathFor(bookingId: string): string {
  return `/messages/for-booking/${bookingId}`
}

/** payments.payment_status → succeeded: the money was actually captured.
 *  Receipt to the customer, "you've been paid" to the provider. Keyed off the
 *  payment row, not customer_confirmed_at, so an unpaid booking can never
 *  produce a paid email (client Round 6 blocker 1). */
async function handlePaymentCaptured(record: Record<string, any>, oldRecord: Record<string, any>) {
  if (record.payment_status !== 'succeeded' || oldRecord.payment_status === 'succeeded') return
  const { data: b } = await supabase
    .from('bookings')
    .select('id, booking_number, scheduled_date, scheduled_time_start, customer_id, provider_id, service_id, commission_rate')
    .eq('id', record.booking_id).maybeSingle()
  if (!b) return

  const [{ data: cp }, { data: pp }, { data: svc }] = await Promise.all([
    supabase.from('customer_profiles').select('user_id, first_name, last_name').eq('id', b.customer_id).maybeSingle(),
    b.provider_id
      ? supabase.from('provider_profiles').select('id, user_id, business_name, first_name, last_name, profile_image_url, rating_average, total_reviews, stripe_account_status, payout_delay_days').eq('id', b.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    b.service_id ? supabase.from('services').select('title').eq('id', b.service_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const providerName = escapeHtml(pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'Your provider')
  const customerName = `${cp?.first_name ?? ''} ${cp?.last_name ?? ''}`.trim() || 'Customer'
  const customerShort = `${cp?.first_name ?? ''} ${(cp?.last_name ?? '').charAt(0)}${cp?.last_name ? '.' : ''}`.trim()
  const service = escapeHtml(svc?.title ?? 'your booking')
  const when = b.scheduled_date ? `${ukDate(b.scheduled_date)}, ${ukTime(b.scheduled_time_start)}` : ''
  const amount = Number(record.amount ?? 0)
  const commission = Number(record.platform_fee_amount ?? 0)
  const payoutPence = Number(record.provider_payout_amount ?? amount - commission)
  const total = poundsFromCents(amount)
  const payout = poundsFromCents(payoutPence)
  const ref = b.booking_number ? String(b.booking_number) : ''
  const rawRate = Number(b.commission_rate ?? 0.12)
  const ratePct = Math.round((rawRate >= 1 ? rawRate : rawRate * 100))
  const card = record.payment_metadata?.card as { brand?: string; last4?: string; statement?: string | null } | undefined
  const paidOn = ukDate((record.captured_at ?? new Date().toISOString()).slice(0, 10))
  // Only set once the client is VAT registered (admin → Settings)
  const vatNumber = await getVatNumber().catch(() => null)

  // Customer: a receipt that reads like a receipt
  if (cp?.user_id) {
    const email = await emailForUser(cp.user_id)
    if (email) {
      await sendEmail(email, `Receipt — ${svc?.title ?? 'your booking'}, ${total} · ${ref}`, renderNotificationEmail({
        tone: 'success', badge: 'Payment receipt', greeting: await hi(cp.user_id),
        heading: 'Your receipt',
        body: `Thanks for confirming the job. ${total} has been charged to your card and paid to ${providerName}. Keep this email for your records.`,
        person: pp ? { name: providerName, avatarUrl: pp.profile_image_url ?? null, rating: Number(pp.rating_average) || null, ratingCount: pp.total_reviews ?? null } : undefined,
        details: [
          { label: 'Service', value: service },
          ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
          { label: 'Amount paid', value: total },
          ...(card?.last4 ? [{ label: 'Paid with', value: `${escapeHtml(String(card.brand ?? 'Card')).replace(/^\w/, c => c.toUpperCase())} •••• ${escapeHtml(String(card.last4))}` }] : []),
          { label: 'Paid on', value: escapeHtml(paidOn) },
          // Only what Stripe says the bank will actually print — never a promise
          ...(card?.statement && !/^stripe$/i.test(card.statement.trim()) ? [{ label: 'Statement shows', value: escapeHtml(String(card.statement)) }] : []),
          ...(ref ? [{ label: 'Reference', value: escapeHtml(ref) }] : []),
          { label: 'Billed by', value: 'Servios Group Ltd' },
          ...(vatNumber ? [{ label: 'VAT number', value: escapeHtml(vatNumber) }] : []),
        ],
        ctaLabel: 'Leave a review',
        ctaPath: `/bookings/${b.id}`,
        secondaryCtas: [{ label: 'View booking', path: `/bookings/${b.id}` }],
        preheader: `${total} paid for ${service} — ${ref}`,
      }))
    }
  }

  // Provider: you've been paid — with the commission line and the bank date
  if (pp?.user_id) {
    const email = await emailForUser(pp.user_id)
    if (email) {
      const connected = pp.stripe_account_status === 'active'
      const delay = Number(pp.payout_delay_days ?? 7)
      const clears = new Date(new Date(record.captured_at ?? Date.now()).getTime() + delay * 86_400_000)
      const bankLine = connected
        ? `It's in your Stripe balance now and clears to your bank on ${escapeHtml(ukDate(clears.toISOString().slice(0, 10)))} — the ${delay}-day clearing period that lets us put any customer problem right fairly.`
        : `Your bank isn't connected yet, so the Servios team will pay this out to you. Connect your bank on the Payouts page to receive future payments automatically.`
      await sendEmail(email, `You've been paid — ${payout} · ${customerShort} · ${ref}`, renderNotificationEmail({
        tone: 'success', badge: 'Payment', greeting: await hi(pp.user_id),
        heading: `You've been paid ${payout}`,
        body: `${escapeHtml(customerName)} confirmed the job is complete. ${bankLine}`,
        details: [
          { label: 'Customer', value: escapeHtml(customerName) },
          { label: 'Service', value: service },
          ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
          { label: 'Job amount', value: total },
          { label: `Servios commission (${ratePct}%)`, value: `−${poundsFromCents(commission)}` },
          { label: 'Your payout', value: payout },
          ...(connected ? [{ label: 'Clears to bank', value: escapeHtml(ukDate(clears.toISOString().slice(0, 10))) }] : []),
          ...(ref ? [{ label: 'Reference', value: escapeHtml(ref) }] : []),
          ...(vatNumber ? [{ label: 'Servios VAT number', value: escapeHtml(vatNumber) }] : []),
        ],
        ctaLabel: 'View earnings',
        ctaPath: '/provider/earnings',
        secondaryCtas: [{ label: 'View booking', path: `/provider/bookings/${b.id}` }],
        preheader: `${payout} from ${customerName} for ${service}`,
      }))
    }
  }
}

async function handleReviewInsert(record: Record<string, any>) {
  if (!record.reviewee_id) return
  const reviewer = await personFor(record.reviewer_id)
  const stars = Math.max(1, Math.min(5, Math.round(Number(record.rating) || 0)))

  const email = await emailForUser(record.reviewee_id)
  if (!email) return

  await sendEmail(email, `New ${stars}-star review from ${reviewer.name}`, renderNotificationEmail({
    tone: stars >= 4 ? 'success' : 'info', badge: stars >= 4 ? 'New review' : undefined, greeting: await hi(record.reviewee_id),
    noteLabel: `${escapeHtml(reviewer.name)} wrote`,
    heading: `New review — ${stars} out of 5`,
    person: { ...reviewer, name: escapeHtml(reviewer.name) },
    note: record.review_text ? escapeHtml(String(record.review_text)) : undefined,
    ctaLabel: 'View your reviews',
    ctaPath: '/provider/reviews',
    preheader: `${reviewer.name} left you ${stars} star${stars !== 1 ? 's' : ''}`,
  }))
}

function addressOf(record: Record<string, any>): string {
  const sa = record.service_address
  if (!sa) return ''
  if (typeof sa === 'string') return sa
  if (typeof sa === 'object') {
    return sa.formatted_address
      ?? [sa.line1 ?? sa.street, sa.line2, sa.city, sa.postcode].filter(Boolean).join(', ')
  }
  return ''
}

async function handleBookingInsert(record: Record<string, any>) {
  if (!record.provider_id) return

  const [{ data: pp }, { data: cp }, { data: svc }] = await Promise.all([
    supabase.from('provider_profiles').select('user_id').eq('id', record.provider_id).maybeSingle(),
    supabase.from('customer_profiles').select('user_id, first_name, last_name, profile_image_url').eq('id', record.customer_id).maybeSingle(),
    record.service_id
      ? supabase.from('services').select('title, duration_minutes').eq('id', record.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!pp?.user_id) return

  const email = await emailForUser(pp.user_id)
  if (!email) return

  const customerName = escapeHtml(`${cp?.first_name ?? ''} ${cp?.last_name ?? ''}`.trim() || 'A customer')
  const customerShort = `${cp?.first_name ?? 'Customer'} ${(cp?.last_name ?? '').charAt(0)}${cp?.last_name ? '.' : ''}`.trim()
  const service = escapeHtml(svc?.title ?? 'a service')
  const emergency = record.is_emergency ? 'emergency ' : ''
  const when = `${ukDate(record.scheduled_date)}, ${ukTime(record.scheduled_time_start)}`
  const price = poundsFromCents(record.total_amount)
  const address = addressOf(record)
  const chatPath = conversationPathFor(record.id)

  // The two things a tradesperson decides on are the price and the location
  // (client feedback) — plus the customer's notes, all on a details card.
  const details = [
    { label: 'Service', value: service },
    { label: 'When', value: escapeHtml(when) },
    ...(svc?.duration_minutes ? [{ label: 'Duration', value: `${svc.duration_minutes} min` }] : []),
    ...(address ? [{ label: 'Location', value: escapeHtml(address) }] : []),
    ...(price ? [{ label: 'Job amount', value: price }] : []),
    ...(record.booking_number ? [{ label: 'Reference', value: escapeHtml(String(record.booking_number)) }] : []),
  ]

  // In-app "New booking request" already comes from the booking form itself —
  // the webhook only owns the email here.
  await sendEmail(
    email,
    `New ${emergency}booking request — ${svc?.title ?? 'Servios'}${price ? `, ${price}` : ''} · ${customerShort} · ${record.booking_number ?? ''}`,
    renderNotificationEmail({
      tone: 'action', badge: 'Reply needed', greeting: await hi(pp.user_id),
      noteLabel: `Note from ${customerName}`,
      heading: `New ${emergency}booking request`,
      person: { name: customerName, avatarUrl: cp?.profile_image_url ?? null, meta: 'Customer' },
      details,
      note: record.customer_notes ? escapeHtml(String(record.customer_notes)) : undefined,
      ctaLabel: 'Accept or decline',
      ctaPath: `/provider/bookings/${record.id}`,
      secondaryCtas: [{ label: 'Message customer', path: chatPath }],
      preheader: `${customerName} — ${service}, ${when}${price ? `, ${price}` : ''}`,
    })
  )
}

async function handleBookingStatusChange(record: Record<string, any>, oldRecord: Record<string, any>) {
  // Confirmation itself sends nothing — the receipt / paid emails fire from
  // the payments row when the capture actually succeeds (handlePaymentCaptured)
  if (record.status === oldRecord.status) return
  if (!['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(record.status)) return

  // A cancelled or declined booking must never keep a card hold — whichever
  // screen cancelled it, the authorisation is released here
  if (record.status === 'cancelled' || record.status === 'rejected') {
    try {
      await cancelHeldPayment(record.id, `booking_${record.status}`)
    } catch (e) {
      console.error('[dispatch] releasing card hold failed:', e)
    }
  }

  // Full context — "Booking BK-… accepted" identifies nothing for a customer
  // with two jobs on the go (client feedback). Name the provider, service,
  // date, time and price, with the provider's photo and rating up top.
  const [{ data: cp }, { data: pp }, { data: svc }] = await Promise.all([
    supabase.from('customer_profiles').select('user_id').eq('id', record.customer_id).maybeSingle(),
    record.provider_id
      ? supabase.from('provider_profiles').select('user_id, business_name, first_name, last_name, profile_image_url, rating_average, total_reviews, trade_category').eq('id', record.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    record.service_id
      ? supabase.from('services').select('title, duration_minutes').eq('id', record.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const providerName = escapeHtml(pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'Your provider')
  const service = escapeHtml(svc?.title ?? 'your booking')
  const when = record.scheduled_date ? `${ukDate(record.scheduled_date)}, ${ukTime(record.scheduled_time_start)}` : ''
  const price = poundsFromCents(record.total_amount)
  const address = addressOf(record)
  const detail = [when, price].filter(Boolean).join(' — ')
  const chatPath = conversationPathFor(record.id)
  const paid = ['authorized', 'paid', 'partially_refunded'].includes(record.payment_status ?? '') || !(Number(record.total_amount) > 0)

  const providerPerson = pp ? {
    name: providerName,
    avatarUrl: pp.profile_image_url ?? null,
    rating: Number(pp.rating_average) || null,
    ratingCount: pp.total_reviews ?? null,
  } : undefined
  const bookingDetails = [
    { label: 'Service', value: service },
    ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
    ...(svc?.duration_minutes ? [{ label: 'Duration', value: `${svc.duration_minutes} min` }] : []),
    ...(address ? [{ label: 'Location', value: escapeHtml(address) }] : []),
    ...(price ? [{ label: 'Price', value: price }] : []),
    // Reference the customer can quote to support — it appears nowhere else
    // in their app (client feedback)
    ...(record.booking_number ? [{ label: 'Reference', value: escapeHtml(String(record.booking_number)) }] : []),
  ]
  const customerCtas = [
    { label: 'Message provider', path: chatPath },
    ...(pp?.user_id ? [{ label: 'View profile', path: `/providers/${pp.user_id}` }] : []),
    // The accepted email is the moment a change of mind happens — the page
    // has the cancel button; give the email the link
    ...(record.status === 'accepted' ? [{ label: 'Cancel booking', path: `/bookings/${record.id}` }] : []),
  ]

  const COPY: Record<string, { subject: string; heading: string; body: string; pre: string }> = {
    accepted: {
      subject: `Booking accepted — ${svc?.title ?? 'your job'} · ${record.booking_number ?? ''}`.trim(),
      heading: 'Booking accepted',
      // The customer's next step is the card authorisation — say so (client:
      // "a customer who only reads email won't know payment is pending")
      body: paid
        ? `You're all set — we'll let you know when work starts.`
        : `One thing before the visit: authorise ${price || 'the payment'} on your card. It's only a hold — nothing is charged until you confirm the job is done, and ${providerName} can't start until it's in place.`,
      pre: paid ? `${providerName} accepted ${service}${detail ? ` · ${detail}` : ''}` : `Next step: authorise ${price || 'payment'} for ${service}`,
    },
    rejected: {
      subject: `Booking declined — ${svc?.title ?? 'your job'} · ${record.booking_number ?? ''}`,
      heading: 'Booking declined',
      body: `${providerName} can't take this job. Nothing has been charged${paid ? ' and the hold on your card has been released' : ''} — you can book another provider straight away.`,
      pre: `${providerName} declined ${service}`,
    },
    in_progress: {
      subject: `Work started — ${svc?.title ?? 'your job'} · ${record.booking_number ?? ''}`,
      heading: 'Work has started',
      body: `Your provider is on the job.`,
      pre: `${providerName} started ${service}`,
    },
    completed: {
      subject: `Job marked complete — ${svc?.title ?? 'your job'} · ${record.booking_number ?? ''}`,
      heading: 'Provider marked your job complete',
      body: `Happy with the work? Confirm to release the ${price || 'payment'}, then leave a review.`,
      pre: `Confirm ${service} to release ${price || 'payment'}`,
    },
    cancelled: {
      subject: `Booking cancelled — ${svc?.title ?? 'your job'} · ${record.booking_number ?? ''}`,
      heading: 'Booking cancelled',
      body: `This booking has been cancelled. If a payment was authorised on your card, the hold has been released — a pending amount can take a few days to disappear from your statement.`,
      pre: `${service}${when ? ` on ${when}` : ''} cancelled`,
    },
  }
  const copy = COPY[record.status]
  if (!copy) return

  // Customer is the audience for status changes (providers drive them);
  // on a cancellation both sides hear about it.
  const targets: { userId: string; path: string }[] = []
  if (cp?.user_id) targets.push({ userId: cp.user_id, path: `/bookings/${record.id}` })
  if (record.status === 'cancelled' && pp?.user_id) {
    targets.push({ userId: pp.user_id, path: `/provider/bookings/${record.id}` })
  }

  // Email only — the booking pages already insert in-app notifications for
  // status changes, and doing it here too double-notified everyone with
  // slightly different wording (Round 4 finding D)
  // The button names the one action the email exists for (client feedback:
  // "confirm and release £90" can't hide behind a View booking label)
  const ctaLabelFor = record.status === 'completed'
    ? `Confirm & release ${price || 'payment'}`
    : record.status === 'accepted' && !paid
      ? `Authorise ${price || 'payment'}`
      : record.status === 'rejected'
        ? 'Find another provider'
        : 'View booking'

  // Cancellations say who cancelled and why, in words that fit the reader
  // (the provider was getting "the hold on your card")
  const cancelledBy = record.status !== 'cancelled' ? null
    : record.cancelled_by && record.cancelled_by === cp?.user_id ? 'customer'
    : record.cancelled_by && record.cancelled_by === pp?.user_id ? 'provider'
    : record.cancelled_by ? 'servios' : null
  const reason = record.cancellation_reason ? escapeHtml(String(record.cancellation_reason)) : undefined
  const cancelBody = (isCustomer: boolean) => {
    const who = cancelledBy === 'servios' ? 'Servios support cancelled this booking.'
      : cancelledBy === 'customer' ? (isCustomer ? 'You cancelled this booking.' : 'The customer cancelled this booking.')
      : cancelledBy === 'provider' ? (isCustomer ? `${providerName} cancelled this booking.` : 'You cancelled this booking.')
      : 'This booking has been cancelled.'
    return isCustomer
      ? `${who} If a payment was authorised on your card, the hold has been released — a pending amount can take a few days to disappear from your statement.`
      : `${who} You don't need to attend, and the slot is free in your calendar again. Any hold on the customer's card has been released, so no payout is due.`
  }

  const statusTone: EmailTone = record.status === 'accepted' ? (paid ? 'success' : 'action')
    : record.status === 'completed' ? 'action'
    : record.status === 'in_progress' ? 'info'
    : 'problem'
  const statusBadge = record.status === 'accepted' ? (paid ? 'Booking confirmed' : 'One step left')
    : record.status === 'completed' ? 'Your confirmation needed'
    : record.status === 'rejected' ? 'Booking declined'
    : record.status === 'cancelled' ? 'Booking cancelled'
    : record.status === 'in_progress' ? 'Work started'
    : undefined

  // The pages add bell notifications for accept / decline / start / complete,
  // but nothing did for a cancellation (client retest, 22 Nov). Tell everyone
  // except whoever cancelled.
  if (record.status === 'cancelled') {
    const plainService = svc?.title ?? 'your booking'
    await Promise.all(targets.filter(t => t.userId !== record.cancelled_by).map(t => {
      const isCustomer = t.userId === cp?.user_id
      const who = cancelledBy === 'servios' ? 'Servios support cancelled this booking'
        : cancelledBy === 'customer' ? 'The customer cancelled this booking'
        : cancelledBy === 'provider' ? 'Your provider cancelled this booking'
        : 'This booking has been cancelled'
      const tail = isCustomer ? 'Any hold on your card has been released.' : 'You don’t need to attend.'
      return notifyInApp(t.userId, 'booking_cancelled', `Booking cancelled — ${plainService}${when ? `, ${when}` : ''}`,
        `${who}${record.cancellation_reason ? `: “${String(record.cancellation_reason).slice(0, 140)}”` : '.'} ${tail}`, { booking_id: record.id })
    }))
  }

  await Promise.all(targets.map(async ({ userId, path }) => {
    const email = await emailForUser(userId)
    if (email) {
      const isCustomer = userId === cp?.user_id
      await sendEmail(email, copy.subject, renderNotificationEmail({
        tone: statusTone, badge: statusBadge, greeting: await hi(userId),
        noteLabel: 'Reason given',
        heading: copy.heading,
        body: record.status === 'cancelled' ? cancelBody(isCustomer) : copy.body,
        // Customers see the provider's card; the provider (cancellations)
        // doesn't need their own face in the email
        person: isCustomer ? providerPerson : undefined,
        details: bookingDetails,
        note: ['cancelled', 'rejected'].includes(record.status) ? reason : undefined,
        ctaLabel: isCustomer ? ctaLabelFor : 'View booking',
        ctaPath: isCustomer && record.status === 'rejected' ? '/search' : path,
        secondaryCtas: isCustomer ? (record.status === 'rejected' ? [{ label: 'View booking', path }] : customerCtas) : undefined,
        preheader: copy.pre,
      }))
    }
  }))
}

async function handleMessageInsert(record: Record<string, any>): Promise<string> {
  const { data: conv } = await supabase
    .from('conversations')
    .select('id, customer_id, provider_id, landlord_id, tenant_id')
    .eq('id', record.conversation_id)
    .maybeSingle()
  if (!conv) return 'no-conversation'

  const participants = [conv.customer_id, conv.provider_id, conv.landlord_id, conv.tenant_id]
    .filter((id): id is string => Boolean(id))
  const recipient = participants.find(id => id !== record.sender_id)
  if (!recipient) return 'no-recipient'

  // Throttle: only the first message of a burst emails/notifies — skip if the
  // sender already messaged this conversation in the previous 30 minutes.
  const windowStart = new Date(new Date(record.created_at).getTime() - 30 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', record.conversation_id)
    .eq('sender_id', record.sender_id)
    .gte('created_at', windowStart)
    .neq('id', record.id)
    .limit(1)
  if (recent && recent.length > 0) return 'throttled'

  const sender = await personFor(record.sender_id)
  const preview = String(record.message_text ?? '').slice(0, 120)

  await notifyInApp(recipient, 'message_new', `New message from ${sender.name}`, preview, {
    conversation_id: record.conversation_id,
  })

  const email = await emailForUser(recipient)
  if (!email) return 'no-email-address'
  return await sendEmail(email, `New message from ${sender.name}`, renderNotificationEmail({
    tone: 'info', greeting: await hi(recipient),
    noteLabel: `${escapeHtml(sender.name)} wrote`,
    heading: 'New message',
    person: { ...sender, name: escapeHtml(sender.name) },
    note: `${escapeHtml(preview)}${record.message_text?.length > 120 ? '…' : ''}`,
    ctaLabel: 'Reply on Servios',
    ctaPath: `/messages/${record.conversation_id}`,
    preheader: preview,
  }))
}

async function handleQuoteInvite(record: Record<string, any>) {
  const { data: qr } = await supabase
    .from('quote_requests')
    .select('id, title, description, area')
    .eq('id', record.quote_request_id)
    .maybeSingle()
  if (!qr) return

  const email = await emailForUser(record.provider_id)
  if (!email) return

  // The title already carries the area ("Plumbing — North London"), so only
  // append it when it isn't there — "…North London in North London" read badly
  const areaSuffix = qr.area && !String(qr.title).includes(qr.area) ? ` in ${escapeHtml(qr.area)}` : ''
  await sendEmail(email, `New quote request — ${qr.title}`, renderNotificationEmail({
    tone: 'action', badge: 'Quote requested', greeting: await hi(record.provider_id),
    noteLabel: 'The customer wrote',
    heading: 'New quote request',
    body: `A customer is looking for <strong>${escapeHtml(qr.title)}</strong>${areaSuffix}. Send your price before other pros do.`,
    details: [
      { label: 'Request', value: escapeHtml(qr.title) },
      ...(qr.area ? [{ label: 'Area', value: escapeHtml(qr.area) }] : []),
    ],
    note: qr.description ? escapeHtml(String(qr.description)).replace(/\n/g, '<br>') : undefined,
    ctaLabel: 'Respond with your price',
    ctaPath: `/provider/quotes/${qr.id}`,
    secondaryCtas: [{ label: 'All quote requests', path: '/provider/quotes' }],
    preheader: `${qr.title} — respond with your price`,
  }))
}

async function handleQuoteResponse(record: Record<string, any>) {
  const { data: qr } = await supabase
    .from('quote_requests')
    .select('id, title, customer_id')
    .eq('id', record.quote_request_id)
    .maybeSingle()
  if (!qr?.customer_id) return

  const provider = await personFor(record.provider_id)
  const amount = Number(record.amount).toFixed(2)

  await notifyInApp(qr.customer_id, 'quote_request', `New quote: £${amount}`, `${provider.name} quoted £${amount} for "${qr.title}".`, {
    quote_request_id: qr.id,
  })

  const email = await emailForUser(qr.customer_id)
  if (email) {
    await sendEmail(email, `You received a quote — £${amount}`, renderNotificationEmail({
      tone: 'info', greeting: await hi(qr.customer_id),
      noteLabel: `Note from ${escapeHtml(provider.name)}`,
      heading: 'You received a quote',
      body: `Compare your quotes and accept the one that suits you.`,
      person: { ...provider, name: escapeHtml(provider.name) },
      details: [
        { label: 'Quote', value: `£${amount}` },
        { label: 'For', value: escapeHtml(qr.title) },
        ...(record.estimated_hours != null ? [{ label: 'Estimated time', value: `${record.estimated_hours}h` }] : []),
      ],
      note: record.notes ? escapeHtml(String(record.notes)) : undefined,
      ctaLabel: 'View & accept quotes',
      ctaPath: `/quotes/${qr.id}`,
      secondaryCtas: [{ label: 'View provider profile', path: `/providers/${record.provider_id}` }],
      preheader: `£${amount} from ${provider.name} for ${qr.title}`,
    }))
  }
}

const DOC_LABELS: Record<string, string> = {
  id: 'photo ID',
  insurance: 'insurance certificate',
  license: 'licence',
  certification: 'certification',
  contract: 'contract',
  other: 'document',
}

/** Admin reviewed a document (approved / rejected) or it lapsed (expired). */
async function handleDocumentStatusChange(record: Record<string, any>, oldRecord: Record<string, any>) {
  if (record.status === oldRecord.status) return
  if (!['approved', 'rejected', 'expired'].includes(record.status)) return

  const { data: pp } = await supabase
    .from('provider_profiles').select('user_id, first_name').eq('id', record.provider_id).maybeSingle()
  if (!pp?.user_id) return

  const title = String(record.title ?? 'Document')
  const typeLabel = DOC_LABELS[record.document_type] ?? 'document'
  const details = [
    { label: 'Document', value: escapeHtml(title) },
    ...(record.verified_number ? [{ label: 'Number', value: escapeHtml(String(record.verified_number)) }] : []),
    ...(record.issuer ? [{ label: 'Issuer', value: escapeHtml(String(record.issuer)) }] : []),
    ...(record.expiry_date ? [{ label: 'Expires', value: escapeHtml(ukDate(record.expiry_date)) }] : []),
  ]

  if (record.status === 'approved') {
    await notifyInApp(pp.user_id, 'document_verified', 'Document approved', `Your ${typeLabel} "${title}" has been approved.`, { document_id: record.id })
    const email = await emailForUser(pp.user_id)
    if (!email) return
    await sendEmail(email, `Approved: ${title}`, renderNotificationEmail({
      tone: 'success', badge: 'Approved', greeting: await hi(pp.user_id),
      heading: 'Document approved',
      body: `We've checked your ${typeLabel} and it's all in order.${['license', 'certification'].includes(record.document_type) ? ' It now shows as a verified credential on your public profile.' : ''}`,
      details,
      ctaLabel: 'View your documents',
      ctaPath: '/provider/documents',
      preheader: `Your ${typeLabel} has been approved`,
    }))
    return
  }

  if (record.status === 'rejected') {
    const reason = record.rejection_reason ? String(record.rejection_reason) : ''
    await notifyInApp(pp.user_id, 'document_rejected', 'Document not approved', reason ? `"${title}" wasn't approved: ${reason}` : `"${title}" wasn't approved. Please upload a replacement.`, { document_id: record.id })
    const email = await emailForUser(pp.user_id)
    if (!email) return
    await sendEmail(email, `Action needed: ${title} wasn't approved`, renderNotificationEmail({
      tone: 'action', greeting: await hi(pp.user_id),
      noteLabel: 'Why it wasn’t approved',
      heading: 'We couldn’t approve this document',
      body: `Our team reviewed your ${typeLabel} and couldn't accept it. Upload a replacement and we'll take another look — usually within one working day.`,
      details: [{ label: 'Document', value: escapeHtml(title) }],
      note: reason ? escapeHtml(reason) : undefined,
      ctaLabel: 'Upload a replacement',
      ctaPath: '/provider/documents',
      preheader: reason || `Your ${typeLabel} needs to be re-uploaded`,
    }))
    return
  }

  // expired
  await notifyInApp(pp.user_id, 'document_expired', 'Document expired', `Your ${typeLabel} "${title}" has expired. Upload a renewed copy to stay verified.`, { document_id: record.id })
  const email = await emailForUser(pp.user_id)
  if (!email) return
  await sendEmail(email, `Your ${typeLabel} has expired`, renderNotificationEmail({
    tone: 'action', greeting: await hi(pp.user_id),
    heading: 'Document expired',
    body: `The expiry date on your ${typeLabel} has passed. Upload the renewed copy to keep your verified status and stay visible to customers.`,
    details,
    ctaLabel: 'Upload the renewal',
    ctaPath: '/provider/documents',
    preheader: `${title} expired on ${ukDate(record.expiry_date)}`,
  }))
}

/** provider_profiles.verification_status changed — by document approval, an
 *  admin decision, or a lapsed document. */
async function handleVerificationChange(record: Record<string, any>, oldRecord: Record<string, any>) {
  const next = record.verification_status
  const prev = oldRecord.verification_status
  if (next === prev || !record.user_id) return
  const userId = record.user_id as string
  const firstName = record.first_name ? escapeHtml(String(record.first_name)) : ''

  if (next === 'verified') {
    await notifyInApp(userId, 'account_verified', 'You’re verified!', 'Your Servios profile is now verified and visible to customers.', {})
    const email = await emailForUser(userId)
    if (!email) return
    await sendEmail(email, 'You’re verified — you’re live on Servios', renderNotificationEmail({
      tone: 'success', badge: 'You’re live',
      heading: `You’re verified${firstName ? `, ${firstName}` : ''}`,
      body: 'Your identity and insurance have been checked and your profile is now live. Customers can find you in search and send booking requests. Keep your availability up to date so the right jobs reach you.',
      ctaLabel: 'Go to your dashboard',
      ctaPath: '/provider',
      secondaryCtas: [{ label: 'See your public profile', path: `/providers/${userId}` }],
      preheader: 'Your profile is live — customers can book you now',
    }))
    return
  }

  if (next === 'rejected') {
    await notifyInApp(userId, 'account_rejected', 'Verification unsuccessful', 'Your provider application wasn’t approved. Contact support if you think this is a mistake.', {})
    const email = await emailForUser(userId)
    if (!email) return
    await sendEmail(email, 'Your Servios application', renderNotificationEmail({
      tone: 'problem', badge: 'Application update', greeting: await hi(userId),
      noteLabel: 'Note from the Servios team',
      heading: 'We couldn’t approve your application',
      body: 'After reviewing your profile and documents we’re not able to verify your account at this time. If you believe this is a mistake, or you can provide further documents, reply to this email or contact support and we’ll take another look.',
      note: record.verification_notes ? escapeHtml(String(record.verification_notes)) : undefined,
      ctaLabel: 'Contact support',
      ctaPath: '/help',
      preheader: 'Your provider application wasn’t approved',
    }))
    return
  }

  if (prev === 'verified' && next === 'pending') {
    await notifyInApp(userId, 'verification_on_hold', 'Verification on hold', 'Your profile has been hidden from search until your documents are up to date.', {})
    const email = await emailForUser(userId)
    if (!email) return
    await sendEmail(email, 'Your verification is on hold', renderNotificationEmail({
      tone: 'action', greeting: await hi(userId),
      noteLabel: 'Note from the Servios team',
      heading: 'Your verification is on hold',
      body: 'Your profile has been temporarily removed from search. This usually means a required document has expired or been withdrawn. Upload an up-to-date copy and you’ll be live again as soon as it’s approved.',
      note: record.verification_notes ? escapeHtml(String(record.verification_notes)) : undefined,
      ctaLabel: 'Check your documents',
      ctaPath: '/provider/documents',
      preheader: 'Your profile is hidden until your documents are up to date',
    }))
  }
}

/* ── Disputes ─────────────────────────────────────────────────────────────── */

const DISPUTE_TYPE_LABEL: Record<string, string> = {
  not_completed: 'Work not finished',
  poor_quality: 'Poor quality work',
  damage: 'Damage to property',
  no_show: 'Provider didn’t turn up',
  overcharged: 'Charged more than agreed',
  problem_after: 'Problem appeared after the job',
  other: 'Something else',
  chargeback: 'Bank chargeback',
}

async function adminUsers(): Promise<{ id: string; email: string | null }[]> {
  const { data } = await supabase.from('users').select('id, email').contains('roles', ['admin'])
  return (data ?? []) as { id: string; email: string | null }[]
}
async function adminEmails(): Promise<string[]> {
  return (await adminUsers()).map(u => u.email).filter((e): e is string => Boolean(e))
}
/** Bell notification for every admin, linking straight to the admin page. */
async function notifyAdmins(type: string, title: string, body: string, href: string, data: Record<string, unknown> = {}) {
  const admins = await adminUsers()
  await Promise.all(admins.map(a => notifyInApp(a.id, type, title, body, { ...data, href })))
}

/** A chargeback's deadline for evidence. Stripe's date is written into the
 *  case when it opens; the provider is asked two days earlier so support has
 *  time to put the response together. */
function chargebackDates(dispute: Record<string, any>): { stripeBy: string | null; providerBy: string | null } {
  const m = String(dispute.dispute_reason ?? '').match(/by (\d{4}-\d{2}-\d{2})/)
  if (!m) return { stripeBy: null, providerBy: null }
  const due = new Date(`${m[1]}T00:00:00Z`)
  const early = new Date(Math.max(due.getTime() - 2 * 86_400_000, Date.now()))
  return { stripeBy: ukDate(m[1]), providerBy: ukDate(early.toISOString().slice(0, 10)) }
}

async function disputeContext(dispute: Record<string, any>) {
  const [{ data: booking }, { data: payment }] = await Promise.all([
    supabase.from('bookings').select('id, booking_number, total_amount, service:services(title)').eq('id', dispute.booking_id).maybeSingle(),
    dispute.payment_id
      ? supabase.from('payments').select('amount, refund_amount, provider_payout_amount').eq('id', dispute.payment_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const service = escapeHtml(String((booking?.service as any)?.title ?? 'your booking'))
  const ref = escapeHtml(String(dispute.dispute_number ?? ''))
  const details = [
    { label: 'Case', value: ref },
    { label: 'Job', value: service },
    ...(booking?.booking_number ? [{ label: 'Booking', value: escapeHtml(String(booking.booking_number)) }] : []),
    { label: 'Issue', value: escapeHtml(DISPUTE_TYPE_LABEL[dispute.dispute_type] ?? 'Problem reported') },
  ]
  return { booking, payment, service, ref, details }
}

async function handleDisputeInsert(record: Record<string, any>) {
  const ctx = await disputeContext(record)
  const [customer, provider] = await Promise.all([personFor(record.filed_by), personFor(record.filed_against)])
  const providerPath = `/provider/bookings/${record.booking_id}#problem`
  const customerPath = `/bookings/${record.booking_id}#problem`

  const bookingRef = ctx.booking?.booking_number ? String(ctx.booking.booking_number) : ''
  const cb = chargebackDates(record)
  const heldPounds = poundsFromCents(Number(record.held_amount ?? 0))
  if (record.source === 'chargeback') {
    await notifyInApp(record.filed_against, 'dispute_opened', `Payment disputed by the customer’s bank — ${heldPounds} on hold`,
      `${ctx.service}${bookingRef ? ` (${bookingRef})` : ''}: your payout is on hold while Servios responds to the bank.${cb.providerBy ? ` Add your evidence by ${cb.providerBy}.` : ' Add your evidence on the case.'}`,
      { booking_id: record.booking_id, dispute_id: record.id })
    const providerEmail = await emailForUser(record.filed_against)
    if (providerEmail) {
      await sendEmail(providerEmail, `Payment disputed by the bank — ${heldPounds} on hold · ${ctx.service}${bookingRef ? ` · ${bookingRef}` : ''}`, renderNotificationEmail({
        tone: 'problem', badge: 'Payment disputed', greeting: await hi(record.filed_against),
        heading: 'The customer’s bank has disputed a payment',
        body: `<strong>${heldPounds} of your payout for this job is on hold</strong> while Servios responds to the bank. The bank decides the outcome, not Servios, and it can take several weeks. If you have photos, messages or anything that shows the work was done, add it on the case${cb.providerBy ? ` by <strong>${escapeHtml(cb.providerBy)}</strong>` : ''} so we can include it in our response.`,
        details: [
          ...ctx.details,
          { label: 'On hold', value: heldPounds },
          ...(cb.providerBy ? [{ label: 'Add evidence by', value: escapeHtml(cb.providerBy) }] : []),
          ...(cb.stripeBy ? [{ label: 'Bank’s deadline', value: escapeHtml(cb.stripeBy) }] : []),
        ],
        ctaLabel: 'Add evidence',
        ctaPath: providerPath,
        preheader: `${heldPounds} on hold for ${ctx.service}${cb.providerBy ? ` — add evidence by ${cb.providerBy}` : ''}`,
      }))
    }
  } else {
    await notifyInApp(record.filed_against, 'dispute_opened', 'A customer reported a problem', `${customer.name} reported a problem with ${ctx.service}. Please respond.`, { booking_id: record.booking_id, dispute_id: record.id })
    const providerEmail = await emailForUser(record.filed_against)
    if (providerEmail) {
      await sendEmail(providerEmail, `Action needed: a problem was reported — ${ctx.service}`, renderNotificationEmail({
        tone: 'action', badge: 'Your reply needed', greeting: await hi(record.filed_against),
        noteLabel: `${escapeHtml(customer.name)} wrote`,
        heading: 'A customer reported a problem',
        body: Number(record.held_amount) > 0
          ? `Please give your side as soon as you can — Servios support reads both before deciding anything. <strong>${poundsFromCents(Number(record.held_amount))} of your payout for this job is on hold</strong> until the case is resolved; the rest of your earnings aren’t affected.`
          : 'Please give your side as soon as you can — Servios support reads both before deciding anything. No payment has been taken for this job yet, so nothing is held.',
        person: { name: escapeHtml(customer.name), avatarUrl: customer.avatarUrl, meta: 'Customer' },
        details: ctx.details,
        note: escapeHtml(String(record.dispute_reason ?? '')),
        ctaLabel: 'Respond to the customer',
        ctaPath: providerPath,
        preheader: `${customer.name}: ${String(record.dispute_reason ?? '').slice(0, 90)}`,
      }))
    }
    const customerEmail = await emailForUser(record.filed_by)
    if (customerEmail) {
      await sendEmail(customerEmail, `We’ve received your report — ${ctx.ref}`, renderNotificationEmail({
        tone: 'info', badge: 'Report received', greeting: await hi(record.filed_by),
        heading: 'We’ve got your report',
        body: `We’ve asked ${escapeHtml(provider.name)} for their side${record.desired_outcome === 'redo' ? ' and to put it right. You haven’t asked for money back, so nothing is on hold; you can still ask for a refund on the case if it isn’t sorted' : ctx.payment ? (Number(record.desired_amount) > 0 && Number(record.desired_amount) < Number(ctx.payment.amount) - Number(ctx.payment.refund_amount ?? 0) ? `, and the ${poundsFromCents(Number(record.desired_amount))} you asked for is held by Servios until it’s sorted` : ', and your payment for this job is on hold until it’s sorted') : ''}. Servios support will review both and reply — usually within 2 working days. You can add photos or more detail any time.`,
        details: ctx.details,
        ctaLabel: 'View your case',
        ctaPath: customerPath,
        preheader: record.desired_outcome === 'redo' ? `Case ${ctx.ref} — we’ve asked the provider to put it right` : `Case ${ctx.ref} — payment on hold while we review`,
      }))
    }
  }

  const isCb = record.source === 'chargeback'
  await notifyAdmins(isCb ? 'chargeback_opened' : 'dispute_opened',
    isCb ? `New chargeback ${record.dispute_number}${cb.stripeBy ? ` — evidence due ${cb.stripeBy}` : ''}` : `New dispute ${record.dispute_number}`,
    `${customer.name} vs ${provider.name} · ${ctx.service}${Number(record.held_amount) > 0 ? ` · ${heldPounds} held` : ''}`,
    `/admin/disputes/${record.id}`, { dispute_id: record.id })
  const admins = await adminEmails()
  await Promise.all(admins.map(email => sendEmail(email, `New ${isCb ? 'chargeback' : 'dispute'} ${ctx.ref} — ${ctx.service}${isCb && cb.stripeBy ? ` — evidence due ${cb.stripeBy}` : ''}`, renderNotificationEmail({
    tone: 'action', badge: isCb && cb.stripeBy ? `Evidence due ${cb.stripeBy}` : undefined, noteLabel: isCb ? 'From the bank' : `${escapeHtml(customer.name)} wrote`,
    heading: isCb ? 'New bank chargeback' : 'New dispute to review',
    body: isCb
      ? `${escapeHtml(customer.name)}’s bank has disputed a payment to ${escapeHtml(provider.name)}. Respond in Stripe${cb.stripeBy ? ` by <strong>${escapeHtml(cb.stripeBy)}</strong>` : ''}; the provider has been asked for evidence${cb.providerBy ? ` by ${escapeHtml(cb.providerBy)}` : ''}. Refund and release are disabled on this case because the bank decides.`
      : `${escapeHtml(customer.name)} vs ${escapeHtml(provider.name)}.`,
    details: [
      ...ctx.details,
      ...(Number(record.held_amount) > 0 ? [{ label: 'Held from provider', value: heldPounds }] : []),
      ...(isCb && cb.stripeBy ? [{ label: 'Evidence due to Stripe', value: escapeHtml(cb.stripeBy) }] : []),
    ],
    note: escapeHtml(String(record.dispute_reason ?? '')),
    ctaLabel: 'Open the case',
    ctaPath: `/admin/disputes/${record.id}`,
    preheader: `${ctx.ref}: ${String(record.dispute_reason ?? '').slice(0, 90)}`,
  }))))
}

async function handleDisputeResolved(record: Record<string, any>, oldRecord: Record<string, any>) {
  if (record.status !== 'resolved' || oldRecord.status === 'resolved') return
  const ctx = await disputeContext(record)
  const provider = await personFor(record.filed_against)
  const refunded = Number(record.refund_amount ?? 0)
  const providerGets = Number(ctx.payment?.provider_payout_amount ?? 0)
  const notes = record.resolution_notes ? escapeHtml(String(record.resolution_notes)) : undefined
  const pounds = (p: number) => `£${(p / 100).toFixed(2)}`

  const copy: Record<string, { customer?: [string, string]; provider: [string, string] }> = {
    full_refund: {
      customer: ['Refund approved', `We’ve refunded ${pounds(refunded)} to your card. It usually shows within 5–10 working days.`],
      provider: ['Case decided: customer refunded', `After reviewing both sides, the customer has been refunded in full and no payout is due for this job.`],
    },
    partial_refund: {
      customer: ['Partial refund approved', `We’ve refunded ${pounds(refunded)} to your card. It usually shows within 5–10 working days.`],
      provider: ['Case decided: partial refund', `The customer was refunded ${pounds(refunded)}. You keep ${pounds(providerGets)} for this job — commission is only taken on what you keep.`],
    },
    release_to_provider: {
      customer: ['Case closed', `After reviewing both sides, the payment has been released to ${escapeHtml(provider.name)}.`],
      provider: ['Case decided in your favour', `The held payment has been released — ${pounds(providerGets)} for this job.`],
    },
    no_action: {
      customer: ['Case closed', 'Servios support has closed this case.'],
      provider: ['Case closed', 'Servios support has closed this case. Your payment for this job is unaffected.'],
    },
    chargeback_won: { provider: ['Chargeback decided in your favour', `The bank ruled for Servios — your ${pounds(providerGets)} for this job has been released.`] },
    chargeback_lost: { provider: ['Chargeback decided for the customer', `The bank returned ${pounds(refunded)} to the customer, so your share of that amount has been reversed.`] },
  }
  const c = copy[record.resolution_type] ?? copy.no_action!

  // The money, line by line — both sides see the same arithmetic
  const paidTotal = Number(ctx.payment?.amount ?? 0)
  const refundedTotal = Number(ctx.payment?.refund_amount ?? 0)
  const kept = Math.max(0, paidTotal - refundedTotal)
  const moneyRows = ctx.payment && paidTotal > 0 ? [
    { label: 'Job total', value: pounds(paidTotal) },
    ...(refundedTotal > 0 ? [{ label: 'Refunded to customer', value: `−${pounds(refundedTotal)}` }] : []),
    { label: 'Customer pays', value: pounds(kept) },
  ] : []
  const providerRows = moneyRows.length ? [
    ...moneyRows,
    ...(kept - providerGets > 0 ? [{ label: 'Servios commission', value: `−${pounds(kept - providerGets)}` }] : []),
    { label: 'You keep', value: pounds(providerGets) },
  ] : []

  // In-app too — decisions used to arrive by email only (Round 6 retest)
  await notifyInApp(record.filed_against, 'dispute_resolved', `${c.provider[0]} — ${record.dispute_number}`, c.provider[1], { dispute_id: record.id, booking_id: record.booking_id })
  if (c.customer && record.source !== 'chargeback') {
    await notifyInApp(record.filed_by, 'dispute_resolved', `${c.customer[0]} — ${record.dispute_number}`, c.customer[1], { dispute_id: record.id, booking_id: record.booking_id })
  }

  const rt = String(record.resolution_type ?? '')
  if (rt.startsWith('chargeback')) {
    await notifyAdmins('chargeback_closed', `Chargeback ${rt === 'chargeback_won' ? 'won' : 'lost'} — ${record.dispute_number}`,
      rt === 'chargeback_won' ? `The bank ruled for Servios. ${provider.name}’s payout has been released.` : `The bank returned ${pounds(refunded)} to the customer. ${provider.name}’s share has been reversed.`,
      `/admin/disputes/${record.id}`, { dispute_id: record.id })
  }
  const providerTone: EmailTone = ['release_to_provider', 'chargeback_won'].includes(rt) ? 'success' : ['full_refund', 'partial_refund', 'chargeback_lost'].includes(rt) ? 'problem' : 'info'
  const customerTone: EmailTone = ['full_refund', 'partial_refund'].includes(rt) ? 'success' : 'info'
  const decisionLabel = rt.startsWith('chargeback') ? 'Outcome' : 'Servios support’s decision'

  const providerEmail = await emailForUser(record.filed_against)
  if (providerEmail) {
    await sendEmail(providerEmail, `${c.provider[0]} — ${ctx.ref}`, renderNotificationEmail({
      tone: providerTone, badge: 'Case decided', greeting: await hi(record.filed_against), noteLabel: decisionLabel,
      heading: c.provider[0], body: c.provider[1], details: [...ctx.details, ...providerRows], note: notes,
      ctaLabel: 'View the case', ctaPath: `/provider/bookings/${record.booking_id}#problem`, preheader: c.provider[1],
    }))
  }
  if (c.customer && record.source !== 'chargeback') {
    const customerEmail = await emailForUser(record.filed_by)
    if (customerEmail) {
      await sendEmail(customerEmail, `${c.customer[0]} — ${ctx.ref}`, renderNotificationEmail({
        tone: customerTone, badge: customerTone === 'success' ? 'Refund on its way' : 'Case decided', greeting: await hi(record.filed_by), noteLabel: decisionLabel,
        heading: c.customer[0], body: c.customer[1], details: [...ctx.details, ...moneyRows], note: notes,
        ctaLabel: 'View the case', ctaPath: `/bookings/${record.booking_id}#problem`, preheader: c.customer[1],
      }))
    }
  }
}

async function handleDisputeMessage(record: Record<string, any>) {
  if (record.visible_to === 'admin') return
  const { data: dispute } = await supabase.from('disputes').select('*').eq('id', record.dispute_id).maybeSingle()
  if (!dispute) return
  const ctx = await disputeContext(dispute)
  const fromLabel = record.sender_role === 'admin' ? 'Servios support'
    : record.sender_role === 'system' ? 'Servios'
    : (await personFor(record.sender_id)).name

  const recipients: { userId: string; path: string }[] = []
  // Status notes ("support is reviewing") stay in the thread; only an "over
  // to you" note emails anyone, and only the party being asked
  const systemOnlyTo = record.sender_role === 'system'
    ? (dispute.status === 'awaiting_customer' ? 'customer' : dispute.status === 'awaiting_provider' ? 'provider' : 'none')
    : null
  const toCustomer = ['all', 'customer'].includes(record.visible_to) && record.sender_role !== 'customer' && (systemOnlyTo === null || systemOnlyTo === 'customer')
  const toProvider = ['all', 'provider'].includes(record.visible_to) && record.sender_role !== 'provider' && (systemOnlyTo === null || systemOnlyTo === 'provider')
  if (toCustomer && dispute.source !== 'chargeback') recipients.push({ userId: dispute.filed_by, path: `/bookings/${dispute.booking_id}#problem` })
  if (toProvider) recipients.push({ userId: dispute.filed_against, path: `/provider/bookings/${dispute.booking_id}#problem` })

  const preview = String(record.body ?? '').slice(0, 140)
  await Promise.all(recipients.map(async r => {
    await notifyInApp(r.userId, 'dispute_message', `Update on case ${dispute.dispute_number}`, `${fromLabel}: ${preview}`, { dispute_id: dispute.id, booking_id: dispute.booking_id })
    const email = await emailForUser(r.userId)
    if (!email) return
    // "Ask customer / Ask provider" is a request, not a reply — say what's
    // needed and by when
    if (record.sender_role === 'system' && dispute.source === 'chargeback') {
      const cb = chargebackDates(dispute)
      const bookingRef = ctx.booking?.booking_number ? ` · ${ctx.booking.booking_number}` : ''
      await sendEmail(email, `Action needed: evidence for the bank — case ${ctx.ref}${bookingRef}`, renderNotificationEmail({
        tone: 'action', badge: 'Your evidence needed', greeting: await hi(r.userId),
        heading: 'We need your evidence for the bank',
        body: `The customer’s bank decides this one, not Servios. To give it the best chance, add anything that shows the work was done${cb.providerBy ? ` by <strong>${escapeHtml(cb.providerBy)}</strong>` : ' as soon as you can'}: photos, messages, what was agreed. We send it to the bank with our response. If we have nothing from you, we respond with what Servios holds on the booking.`,
        details: [
          ...ctx.details,
          ...(Number(dispute.held_amount) > 0 ? [{ label: 'On hold', value: poundsFromCents(Number(dispute.held_amount)) }] : []),
          ...(cb.stripeBy ? [{ label: 'Bank’s deadline', value: escapeHtml(cb.stripeBy) }] : []),
        ],
        ctaLabel: 'Add evidence',
        ctaPath: r.path,
        preheader: `Add your evidence on case ${ctx.ref}${cb.providerBy ? ` by ${cb.providerBy}` : ''}`,
      }))
      return
    }
    if (record.sender_role === 'system') {
      const by = ukDate(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10))
      await sendEmail(email, `Action needed: we need your side on case ${ctx.ref}`, renderNotificationEmail({
        tone: 'action', badge: 'Your reply needed', greeting: await hi(r.userId),
        heading: 'We need to hear from you',
        body: `Servios support can't decide this case without your side. Please reply on the case by <strong>${escapeHtml(by)}</strong> — add anything that helps: what was agreed, what happened, photos. If we don't hear back, we'll decide on what we have.`,
        details: ctx.details,
        ctaLabel: 'Reply on the case',
        ctaPath: r.path,
        preheader: `Please reply on case ${ctx.ref} by ${by}`,
      }))
      return
    }
    await sendEmail(email, `${fromLabel} replied — case ${ctx.ref}`, renderNotificationEmail({
      tone: 'info', greeting: await hi(r.userId), noteLabel: `${escapeHtml(fromLabel)} wrote`,
      heading: `New reply from ${escapeHtml(fromLabel)}`,
      details: ctx.details,
      note: escapeHtml(String(record.body ?? '')).replace(/\n/g, '<br>'),
      ctaLabel: 'Reply on Servios',
      ctaPath: r.path,
      preheader: preview,
    }))
  }))

  // Parties replying → support needs to know
  if (record.sender_role === 'customer' || record.sender_role === 'provider') {
    const admins = await adminEmails()
    await Promise.all(admins.map(email => sendEmail(email, `Reply on ${ctx.ref} from the ${record.sender_role}`, renderNotificationEmail({
      tone: 'info', noteLabel: `The ${record.sender_role} wrote`,
      heading: `${record.sender_role === 'customer' ? 'Customer' : 'Provider'} replied`,
      details: ctx.details,
      note: escapeHtml(String(record.body ?? '')).replace(/\n/g, '<br>'),
      ctaLabel: 'Open the case',
      ctaPath: `/admin/disputes/${dispute.id}`,
      preheader: preview,
    }))))
  }
}

/** A provider reported a review — tell the admins. */
async function handleReviewFlagged(record: Record<string, any>, oldRecord: Record<string, any>) {
  if (!record.is_flagged || oldRecord.is_flagged) return
  const [provider, reviewer] = await Promise.all([personFor(record.reviewee_id), personFor(record.reviewer_id)])
  const admins = await adminEmails()
  await Promise.all(admins.map(email => sendEmail(email, `Review reported by ${provider.name}`, renderNotificationEmail({
    tone: 'action', noteLabel: 'The review',
    heading: 'A review was reported',
    body: `${escapeHtml(provider.name)} reported a ${record.rating}-star review from ${escapeHtml(reviewer.name)}.`,
    details: [{ label: 'Rating', value: `${record.rating} out of 5` }, { label: 'Reason given', value: escapeHtml(String(record.flag_reason ?? '')) }],
    note: record.review_text ? escapeHtml(String(record.review_text)) : undefined,
    ctaLabel: 'Review it',
    ctaPath: '/admin/reviews?filter=flagged',
    preheader: String(record.flag_reason ?? '').slice(0, 90),
  }))))
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  let detail: string | undefined
  try {
    if (payload.table === 'bookings' && payload.type === 'INSERT') {
      await handleBookingInsert(payload.record)
    } else if (payload.table === 'bookings' && payload.type === 'UPDATE' && payload.old_record) {
      await handleBookingStatusChange(payload.record, payload.old_record)
    } else if (payload.table === 'messages' && payload.type === 'INSERT') {
      detail = await handleMessageInsert(payload.record)
    } else if (payload.table === 'quote_request_providers' && payload.type === 'INSERT') {
      await handleQuoteInvite(payload.record)
    } else if (payload.table === 'quote_responses' && payload.type === 'INSERT') {
      await handleQuoteResponse(payload.record)
    } else if (payload.table === 'reviews' && payload.type === 'INSERT') {
      await handleReviewInsert(payload.record)
    } else if (payload.table === 'provider_documents' && payload.type === 'UPDATE' && payload.old_record) {
      await handleDocumentStatusChange(payload.record, payload.old_record)
    } else if (payload.table === 'provider_profiles' && payload.type === 'UPDATE' && payload.old_record) {
      await handleVerificationChange(payload.record, payload.old_record)
    } else if (payload.table === 'payments' && payload.type === 'UPDATE' && payload.old_record) {
      await handlePaymentCaptured(payload.record, payload.old_record)
    } else if (payload.table === 'reviews' && payload.type === 'UPDATE' && payload.old_record) {
      await handleReviewFlagged(payload.record, payload.old_record)
    } else if (payload.table === 'disputes' && payload.type === 'INSERT') {
      await handleDisputeInsert(payload.record)
    } else if (payload.table === 'disputes' && payload.type === 'UPDATE' && payload.old_record) {
      await handleDisputeResolved(payload.record, payload.old_record)
    } else if (payload.table === 'dispute_messages' && payload.type === 'INSERT') {
      await handleDisputeMessage(payload.record)
    }
  } catch (e) {
    // Log and swallow — a notification failure must never look like a data
    // failure to the trigger, and pg_net doesn't retry anyway
    console.error('[dispatch] notification failed:', e)
    return NextResponse.json({ ok: true, error: e instanceof Error ? e.message.slice(0, 120) : 'handler failed' })
  }

  // Surface email config state in the response — it lands in net._http_response,
  // so a broken email leg is visible from the database instead of silent
  const emailConfigured = Boolean((process.env.RESEND_API_KEY ?? '').trim() && (process.env.RESEND_FROM_EMAIL ?? '').trim())
  return NextResponse.json({ ok: true, email: emailConfigured ? 'configured' : 'NOT_CONFIGURED', ...(detail ? { detail } : {}) })
}
