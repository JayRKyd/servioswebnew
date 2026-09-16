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

async function displayName(userId: string): Promise<string> {
  const { data: pp } = await supabase
    .from('provider_profiles')
    .select('business_name, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (pp) return pp.business_name?.trim() || `${pp.first_name ?? ''} ${pp.last_name ?? ''}`.trim() || 'A provider'
  const { data: cp } = await supabase
    .from('customer_profiles')
    .select('first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle()
  if (cp) return `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim() || 'A customer'
  return 'Someone'
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

async function handleBookingInsert(record: Record<string, any>) {
  if (!record.provider_id) return

  const [{ data: pp }, { data: cp }, { data: svc }] = await Promise.all([
    supabase.from('provider_profiles').select('user_id').eq('id', record.provider_id).maybeSingle(),
    supabase.from('customer_profiles').select('user_id, first_name, last_name').eq('id', record.customer_id).maybeSingle(),
    record.service_id
      ? supabase.from('services').select('title').eq('id', record.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (!pp?.user_id) return

  const email = await emailForUser(pp.user_id)
  if (!email) return

  const customerName = escapeHtml(`${cp?.first_name ?? ''} ${cp?.last_name ?? ''}`.trim() || 'A customer')
  const service = escapeHtml(svc?.title ?? 'a service')
  const emergency = record.is_emergency ? 'emergency ' : ''
  const when = `${ukDate(record.scheduled_date)} at ${ukTime(record.scheduled_time_start)}`

  // In-app "New booking request" already comes from the booking form itself —
  // the webhook only owns the email here.
  await sendEmail(
    email,
    `New ${emergency}booking request — ${svc?.title ?? 'Servios'}`,
    renderNotificationEmail({
      heading: `New ${emergency}booking request`,
      body: `${customerName} has requested <strong>${service}</strong> on ${escapeHtml(when)}. Review the details and accept or decline.`,
      ctaLabel: 'View booking request',
      ctaPath: `/provider/bookings/${record.id}`,
      preheader: `${customerName} — ${service}, ${when}`,
    })
  )
}

async function handleBookingStatusChange(record: Record<string, any>, oldRecord: Record<string, any>) {
  if (record.status === oldRecord.status) return
  if (!['accepted', 'rejected', 'in_progress', 'completed', 'cancelled'].includes(record.status)) return

  // Full context — "Booking BK-… accepted" identifies nothing for a customer
  // with two jobs on the go (client feedback). Name the provider, service,
  // date, time and price.
  const [{ data: cp }, { data: pp }, { data: svc }] = await Promise.all([
    supabase.from('customer_profiles').select('user_id').eq('id', record.customer_id).maybeSingle(),
    record.provider_id
      ? supabase.from('provider_profiles').select('user_id, business_name, first_name, last_name').eq('id', record.provider_id).maybeSingle()
      : Promise.resolve({ data: null }),
    record.service_id
      ? supabase.from('services').select('title').eq('id', record.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const providerName = escapeHtml(pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'Your provider')
  const service = escapeHtml(svc?.title ?? 'your booking')
  const when = record.scheduled_date ? `${ukDate(record.scheduled_date)} at ${ukTime(record.scheduled_time_start)}` : ''
  const price = poundsFromCents(record.total_amount)
  const detail = [when, price].filter(Boolean).join(' — ')

  const COPY: Record<string, { subject: string; heading: string; body: string; pre: string }> = {
    accepted: {
      subject: `Booking accepted — ${svc?.title ?? 'your job'}`,
      heading: 'Booking accepted',
      body: `<strong>${providerName}</strong> accepted your <strong>${service}</strong>${when ? ` on ${escapeHtml(when)}` : ''}${price ? ` — ${price}` : ''}. You're all set; we'll let you know when work starts.`,
      pre: `${providerName} accepted ${service}${detail ? ` · ${detail}` : ''}`,
    },
    rejected: {
      subject: `Booking declined — ${svc?.title ?? 'your job'}`,
      heading: 'Booking declined',
      body: `<strong>${providerName}</strong> can't take your <strong>${service}</strong>${when ? ` on ${escapeHtml(when)}` : ''}. Your payment is not taken for declined bookings — you can request another provider any time.`,
      pre: `${providerName} declined ${service}`,
    },
    in_progress: {
      subject: `Work started — ${svc?.title ?? 'your job'}`,
      heading: 'Work has started',
      body: `<strong>${providerName}</strong> has started work on your <strong>${service}</strong>${when ? ` (${escapeHtml(when)})` : ''}.`,
      pre: `${providerName} started ${service}`,
    },
    completed: {
      subject: `Job marked complete — ${svc?.title ?? 'your job'}`,
      heading: 'Provider marked your job complete',
      body: `<strong>${providerName}</strong> marked your <strong>${service}</strong>${when ? ` (${escapeHtml(when)})` : ''} as complete. Happy with the work? Confirm to release the ${price || 'payment'}, then leave a review.`,
      pre: `Confirm ${service} to release ${price || 'payment'}`,
    },
    cancelled: {
      subject: `Booking cancelled — ${svc?.title ?? 'your job'}`,
      heading: 'Booking cancelled',
      body: `Your <strong>${service}</strong>${when ? ` on ${escapeHtml(when)}` : ''} with <strong>${providerName}</strong> has been cancelled.`,
      pre: `${service}${when ? ` on ${when}` : ''} cancelled`,
    },
  }
  const copy = COPY[record.status]

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
  await Promise.all(targets.map(async ({ userId, path }) => {
    const email = await emailForUser(userId)
    if (email) {
      await sendEmail(email, copy.subject, renderNotificationEmail({
        heading: copy.heading,
        body: copy.body,
        ctaLabel: 'View booking',
        ctaPath: path,
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

  const senderName = await displayName(record.sender_id)
  const preview = String(record.message_text ?? '').slice(0, 120)

  await notifyInApp(recipient, 'message_new', `New message from ${senderName}`, preview, {
    conversation_id: record.conversation_id,
  })

  const email = await emailForUser(recipient)
  if (!email) return 'no-email-address'
  return await sendEmail(email, `New message from ${senderName}`, renderNotificationEmail({
    heading: `New message from ${escapeHtml(senderName)}`,
    body: `&ldquo;${escapeHtml(preview)}${record.message_text?.length > 120 ? '…' : ''}&rdquo;`,
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
    ctaLabel: 'View request & respond',
    ctaPath: `/provider/quotes/${qr.id}`,
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

  const { data: pp } = await supabase
    .from('provider_profiles')
    .select('business_name, first_name, last_name')
    .eq('user_id', record.provider_id)
    .maybeSingle()
  const providerName = pp?.business_name?.trim() || `${pp?.first_name ?? ''} ${pp?.last_name ?? ''}`.trim() || 'A provider'
  const amount = Number(record.amount).toFixed(2)

  await notifyInApp(qr.customer_id, 'quote_request', `New quote: £${amount}`, `${providerName} quoted £${amount} for "${qr.title}".`, {
    quote_request_id: qr.id,
  })

  const email = await emailForUser(qr.customer_id)
  if (email) {
    await sendEmail(email, `You received a quote — £${amount}`, renderNotificationEmail({
      heading: `${escapeHtml(providerName)} sent you a quote`,
      body: `<strong>£${amount}</strong> for &ldquo;${escapeHtml(qr.title)}&rdquo;. Compare your quotes and accept the one that suits you.`,
      ctaLabel: 'View quotes',
      ctaPath: `/quotes/${qr.id}`,
      preheader: `£${amount} from ${providerName} for ${qr.title}`,
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
