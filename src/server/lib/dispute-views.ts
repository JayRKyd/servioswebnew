import { supabase } from '../db/client'
import { latestPaymentForBooking, paymentById, type PaymentRow } from './payments'
import { previewResolution, OPEN_STATUSES } from './disputes'

export type Viewer = 'customer' | 'provider' | 'admin'

async function signPaths(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const clean = Array.from(new Set(paths.filter(Boolean)))
  if (clean.length === 0) return {}
  const { data } = await supabase.storage.from(bucket).createSignedUrls(clean, 900)
  const out: Record<string, string> = {}
  for (const s of data ?? []) if (s.path && s.signedUrl) out[s.path] = s.signedUrl
  return out
}

function kindOf(path: string): 'image' | 'pdf' | 'file' {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'image'
  return 'file'
}

async function personSummary(userId: string | null) {
  if (!userId) return null
  const [{ data: u }, { data: pp }, { data: cp }] = await Promise.all([
    supabase.from('users').select('id, email, phone, created_at').eq('id', userId).maybeSingle(),
    supabase.from('provider_profiles').select('id, business_name, first_name, last_name, profile_image_url, rating_average, total_reviews, total_jobs_completed, verification_status').eq('user_id', userId).maybeSingle(),
    supabase.from('customer_profiles').select('id, first_name, last_name, profile_image_url').eq('user_id', userId).maybeSingle(),
  ])
  const name = pp
    ? (pp.business_name?.trim() || `${pp.first_name ?? ''} ${pp.last_name ?? ''}`.trim())
    : `${cp?.first_name ?? ''} ${cp?.last_name ?? ''}`.trim()
  return {
    userId,
    name: name || u?.email || 'Unknown',
    email: u?.email ?? null,
    phone: u?.phone ?? null,
    avatarUrl: pp?.profile_image_url ?? cp?.profile_image_url ?? null,
    joinedAt: u?.created_at ?? null,
    provider: pp ? { profileId: pp.id, rating: Number(pp.rating_average) || null, reviews: pp.total_reviews ?? 0, jobs: pp.total_jobs_completed ?? 0, verification: pp.verification_status } : null,
  }
}

/** Everything one viewer is allowed to see about a dispute. Admins also get
 *  the booking chat, booking photos, money breakdown and audit trail. */
export async function loadDisputeView(disputeId: string, viewer: Viewer) {
  const { data: dispute } = await supabase.from('disputes').select('*').eq('id', disputeId).maybeSingle()
  if (!dispute) return null

  const visible = viewer === 'admin' ? ['all', 'customer', 'provider', 'admin'] : viewer === 'customer' ? ['all', 'customer'] : ['all', 'provider']
  const [{ data: messages }, { data: booking }] = await Promise.all([
    supabase.from('dispute_messages').select('*').eq('dispute_id', disputeId).in('visible_to', visible).order('created_at', { ascending: true }),
    supabase.from('bookings')
      .select('id, booking_number, status, scheduled_date, scheduled_time_start, total_amount, base_amount, platform_fee, commission_rate, customer_confirmed_at, completed_at, payment_status, service_address, customer_notes, service:services(title)')
      .eq('id', dispute.booking_id).maybeSingle(),
  ])

  const evidencePaths: string[] = Array.isArray(dispute.evidence_urls) ? dispute.evidence_urls : []
  const attachmentPaths = (messages ?? []).flatMap(m => (Array.isArray(m.attachments) ? m.attachments : []))
  const signed = await signPaths('dispute-evidence', [...evidencePaths, ...attachmentPaths])
  const asFiles = (paths: string[]) => paths.map(p => ({ path: p, url: signed[p] ?? null, kind: kindOf(p) }))

  const [customer, provider] = await Promise.all([personSummary(dispute.filed_by), personSummary(dispute.filed_against)])

  const thread = (messages ?? []).map(m => ({
    id: m.id,
    role: m.sender_role as 'customer' | 'provider' | 'admin' | 'system',
    senderName: m.sender_role === 'admin' ? 'Servios support' : m.sender_role === 'system' ? 'Servios' : m.sender_id === customer?.userId ? customer?.name : provider?.name,
    body: m.body,
    visibleTo: m.visible_to,
    createdAt: m.created_at,
    attachments: asFiles(Array.isArray(m.attachments) ? m.attachments : []),
  }))

  const base = {
    dispute: {
      id: dispute.id,
      number: dispute.dispute_number,
      status: dispute.status,
      open: (OPEN_STATUSES as readonly string[]).includes(dispute.status),
      source: dispute.source,
      type: dispute.dispute_type,
      reason: dispute.dispute_reason,
      desiredOutcome: dispute.desired_outcome,
      desiredAmount: dispute.desired_amount != null ? Number(dispute.desired_amount) : null,
      providerResponse: dispute.provider_response,
      providerRespondedAt: dispute.provider_responded_at,
      resolutionType: dispute.resolution_type,
      resolutionNotes: dispute.resolution_notes,
      refundAmount: dispute.refund_amount != null ? Number(dispute.refund_amount) : null,
      filedAt: dispute.filed_at,
      resolvedAt: dispute.resolved_at,
      evidence: asFiles(evidencePaths),
    },
    booking: booking ? {
      id: booking.id,
      number: booking.booking_number,
      status: booking.status,
      service: (booking.service as any)?.title ?? null,
      scheduledDate: booking.scheduled_date,
      total: Number(booking.total_amount),
      confirmedAt: booking.customer_confirmed_at,
    } : null,
    customer: customer ? { name: customer.name, avatarUrl: customer.avatarUrl } : null,
    provider: provider ? { name: provider.name, avatarUrl: provider.avatarUrl, userId: provider.userId } : null,
    thread,
  }
  if (viewer !== 'admin') return base

  // ── Admin-only context ──
  const payment: PaymentRow | null = dispute.payment_id ? await paymentById(dispute.payment_id) : await latestPaymentForBooking(dispute.booking_id)
  const rawRate = Number(booking?.commission_rate ?? 0.12)
  const rate = rawRate >= 1 ? rawRate / 100 : rawRate

  const [{ data: conv }, { data: photos }, { data: audit }] = await Promise.all([
    supabase.from('conversations').select('id').eq('booking_id', dispute.booking_id).maybeSingle(),
    supabase.from('booking_photos').select('id, storage_path, url, type, created_at, uploaded_by').eq('booking_id', dispute.booking_id).order('created_at'),
    supabase.from('admin_actions').select('id, actor_id, action, reason, created_at, after').eq('target_id', disputeId).order('created_at', { ascending: false }).limit(50),
  ])
  let chat: { id: string; senderId: string; body: string; createdAt: string }[] = []
  if (conv?.id) {
    const { data: msgs } = await supabase.from('messages').select('id, sender_id, message_text, created_at').eq('conversation_id', conv.id).order('created_at').limit(300)
    chat = (msgs ?? []).map(m => ({ id: m.id, senderId: m.sender_id, body: m.message_text, createdAt: m.created_at }))
  }
  const photoPaths = (photos ?? []).map(p => p.storage_path ?? p.url).filter(Boolean) as string[]
  const signedPhotos = await signPaths('booking-photos', photoPaths)

  return {
    ...base,
    customer,
    provider,
    chat: chat.map(c => ({ ...c, senderName: c.senderId === customer?.userId ? customer?.name : c.senderId === provider?.userId ? provider?.name : 'Other' , fromCustomer: c.senderId === customer?.userId })),
    conversationId: conv?.id ?? null,
    photos: (photos ?? []).map(p => {
      const path = (p.storage_path ?? p.url) as string
      return { id: p.id, type: p.type, url: signedPhotos[path] ?? null, by: p.uploaded_by === customer?.userId ? 'customer' : 'provider', createdAt: p.created_at }
    }),
    payment: payment ? {
      id: payment.id,
      status: payment.payment_status,
      method: payment.payment_method,
      amount: Number(payment.amount),
      refunded: Number(payment.refund_amount ?? 0),
      commission: Number(payment.platform_fee_amount ?? 0),
      providerShare: Number(payment.provider_payout_amount ?? 0),
      transferred: Number(payment.transferred_amount ?? 0) - Number(payment.reversed_amount ?? 0),
      held: Number(dispute.held_amount ?? 0),
      simulated: !!payment.payment_intent_id?.startsWith('sim_'),
      intentId: payment.payment_intent_id,
    } : null,
    rate,
    previews: {
      full_refund: previewResolution(payment, rate, 'full_refund'),
      release_to_provider: previewResolution(payment, rate, 'release_to_provider'),
    },
    audit: audit ?? [],
    priority: dispute.priority,
    stripeDisputeId: dispute.stripe_dispute_id,
  }
}

export async function listDisputesForAdmin(status: 'open' | 'resolved' | 'all') {
  let q = supabase.from('disputes')
    .select('id, dispute_number, status, priority, source, dispute_type, desired_outcome, desired_amount, held_amount, refund_amount, resolution_type, filed_at, updated_at, resolved_at, filed_by, filed_against, provider_responded_at, booking:bookings(id, booking_number, total_amount, service:services(title))')
    .order('filed_at', { ascending: false })
    .limit(200)
  if (status === 'open') q = q.in('status', OPEN_STATUSES as unknown as string[])
  if (status === 'resolved') q = q.in('status', ['resolved', 'closed'])
  const { data, error } = await q
  if (error) throw error

  const ids = Array.from(new Set((data ?? []).flatMap(d => [d.filed_by, d.filed_against]).filter(Boolean))) as string[]
  const names: Record<string, string> = {}
  if (ids.length) {
    const [{ data: pps }, { data: cps }, { data: us }] = await Promise.all([
      supabase.from('provider_profiles').select('user_id, business_name, first_name, last_name').in('user_id', ids),
      supabase.from('customer_profiles').select('user_id, first_name, last_name').in('user_id', ids),
      supabase.from('users').select('id, email').in('id', ids),
    ])
    for (const u of us ?? []) names[u.id] = u.email
    for (const c of cps ?? []) { const n = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(); if (n) names[c.user_id] = n }
    for (const p of pps ?? []) { const n = p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(); if (n) names[p.user_id] = n }
  }
  return (data ?? []).map(d => ({
    id: d.id,
    number: d.dispute_number,
    status: d.status,
    priority: d.priority,
    source: d.source,
    type: d.dispute_type,
    desiredOutcome: d.desired_outcome,
    desiredAmount: d.desired_amount != null ? Number(d.desired_amount) : null,
    held: Number(d.held_amount ?? 0),
    refunded: d.refund_amount != null ? Number(d.refund_amount) : null,
    resolutionType: d.resolution_type,
    filedAt: d.filed_at,
    updatedAt: d.updated_at,
    resolvedAt: d.resolved_at,
    providerResponded: !!d.provider_responded_at,
    customerName: names[d.filed_by] ?? 'Customer',
    providerName: names[d.filed_against] ?? 'Provider',
    booking: d.booking ? { id: (d.booking as any).id, number: (d.booking as any).booking_number, total: Number((d.booking as any).total_amount), service: (d.booking as any).service?.title ?? null } : null,
  }))
}
