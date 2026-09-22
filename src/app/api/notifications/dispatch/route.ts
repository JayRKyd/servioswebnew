import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/server/lib/notifications'
import { renderNotificationEmail, escapeHtml, ukDate, ukTime, poundsFromCents } from '@/server/lib/email-templates'

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

async function conversationPathFor(bookingId: string, fallback: string): Promise<string> {
  // "Message" links should land in the chat, not on the booking page the
  // primary button already opens (client feedback)
  const { data: conv } = await supabase
    .from('conversations').select('id').eq('booking_id', bookingId).maybeSingle()
  return conv ? `/messages/${conv.id}` : fallback
}

async function handlePaymentReleased(record: Record<string, any>) {
  const [{ data: cp }, { data: pp }, { data: svc }] = await Promise.all([
    supabase.from('customer_profiles').select('user_id, first_name, last_name').eq('id', record.customer_id).maybeSingle(),
    record.provider_id
      ? supabase.from('provider_profiles').select('user_id, business_name, first_name, last_name, profile_image_url, rating_average, total_reviews').eq('id', record.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    record.service_id
      ? supabase.from('services').select('title, duration_minutes').eq('id', record.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const providerName = escapeHtml(pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'Your provider')
  const service = escapeHtml(svc?.title ?? 'your booking')
  const when = record.scheduled_date ? `${ukDate(record.scheduled_date)}, ${ukTime(record.scheduled_time_start)}` : ''
  const total = poundsFromCents(record.total_amount)
  const payout = poundsFromCents((record.total_amount ?? 0) - (record.platform_fee ?? 0))
  const ref = record.booking_number ? String(record.booking_number) : ''

  // Customer: the receipt
  if (cp?.user_id) {
    const email = await emailForUser(cp.user_id)
    if (email) {
      await sendEmail(email, `Payment receipt — ${svc?.title ?? 'your booking'}${total ? `, ${total}` : ''}`, renderNotificationEmail({
        heading: 'Payment released — your receipt',
        body: 'Thanks for confirming the job. Here are the details for your records.',
        person: pp ? { name: providerName, avatarUrl: pp.profile_image_url ?? null, rating: Number(pp.rating_average) || null, ratingCount: pp.total_reviews ?? null } : undefined,
        details: [
          { label: 'Service', value: service },
          ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
          ...(total ? [{ label: 'Amount paid', value: total }] : []),
          ...(ref ? [{ label: 'Reference', value: escapeHtml(ref) }] : []),
        ],
        ctaLabel: 'Leave a review',
        ctaPath: `/bookings/${record.id}`,
        secondaryCtas: [{ label: 'View booking', path: `/bookings/${record.id}` }],
        preheader: `${total || 'Payment'} released to ${providerName} for ${service}`,
      }))
    }
  }

  // Provider: you've been paid
  if (pp?.user_id) {
    const email = await emailForUser(pp.user_id)
    if (email) {
      await sendEmail(email, `You've been paid — ${payout || total}`, renderNotificationEmail({
        heading: "You've been paid",
        body: 'The customer confirmed the job is complete and your payout has been released.',
        details: [
          { label: 'Service', value: service },
          ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
          ...(total ? [{ label: 'Job amount', value: total }] : []),
          ...(payout ? [{ label: 'Your payout', value: payout }] : []),
          ...(ref ? [{ label: 'Reference', value: escapeHtml(ref) }] : []),
        ],
        ctaLabel: 'View earnings',
        ctaPath: '/provider/earnings',
        secondaryCtas: [{ label: 'View booking', path: `/provider/bookings/${record.id}` }],
        preheader: `${payout || total} released for ${service}`,
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
    heading: `New review — ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
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
  const service = escapeHtml(svc?.title ?? 'a service')
  const emergency = record.is_emergency ? 'emergency ' : ''
  const when = `${ukDate(record.scheduled_date)}, ${ukTime(record.scheduled_time_start)}`
  const price = poundsFromCents(record.total_amount)
  const address = addressOf(record)
  const chatPath = await conversationPathFor(record.id, `/provider/bookings/${record.id}`)

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
    `New ${emergency}booking request — ${svc?.title ?? 'Servios'}${price ? `, ${price}` : ''}`,
    renderNotificationEmail({
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
  // Customer confirming completion releases the escrow — that transition
  // (not the status, which is already 'completed') sends the receipt and
  // the you've-been-paid emails both sides look for in a dispute.
  if (record.customer_confirmed_at && !oldRecord.customer_confirmed_at) {
    return handlePaymentReleased(record)
  }
  if (record.status === oldRecord.status) return
  if (!['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(record.status)) return

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
  const chatPath = await conversationPathFor(record.id, `/bookings/${record.id}`)

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
      subject: `Booking accepted — ${svc?.title ?? 'your job'}`,
      heading: 'Booking accepted',
      body: `You're all set — we'll let you know when work starts.`,
      pre: `${providerName} accepted ${service}${detail ? ` · ${detail}` : ''}`,
    },
    rejected: {
      subject: `Booking declined — ${svc?.title ?? 'your job'}`,
      heading: 'Booking declined',
      body: `This provider can't take the job. Nothing is charged for declined bookings — you can request another provider any time.`,
      pre: `${providerName} declined ${service}`,
    },
    in_progress: {
      subject: `Work started — ${svc?.title ?? 'your job'}`,
      heading: 'Work has started',
      body: `Your provider is on the job.`,
      pre: `${providerName} started ${service}`,
    },
    completed: {
      subject: `Job marked complete — ${svc?.title ?? 'your job'}`,
      heading: 'Provider marked your job complete',
      body: `Happy with the work? Confirm to release the ${price || 'payment'}, then leave a review.`,
      pre: `Confirm ${service} to release ${price || 'payment'}`,
    },
    cancelled: {
      subject: `Booking cancelled — ${svc?.title ?? 'your job'}`,
      heading: 'Booking cancelled',
      body: `This booking has been cancelled.`,
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
    : 'View booking'

  await Promise.all(targets.map(async ({ userId, path }) => {
    const email = await emailForUser(userId)
    if (email) {
      const isCustomer = userId === cp?.user_id
      await sendEmail(email, copy.subject, renderNotificationEmail({
        heading: copy.heading,
        body: copy.body,
        // Customers see the provider's card; the provider (cancellations)
        // doesn't need their own face in the email
        person: isCustomer ? providerPerson : undefined,
        details: bookingDetails,
        ctaLabel: isCustomer ? ctaLabelFor : 'View booking',
        ctaPath: path,
        secondaryCtas: isCustomer ? customerCtas : undefined,
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

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
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
