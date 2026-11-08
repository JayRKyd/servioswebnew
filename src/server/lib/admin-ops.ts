import { supabase } from '../db/client'
import { latestPaymentForBooking, refundPayment, PAYMENT_COLUMNS } from './payments'
import { OPEN_STATUSES } from './disputes'
import { sendEmail } from './notifications'
import { renderNotificationEmail, escapeHtml, ukDate, ukTime, poundsFromCents } from './email-templates'

export class AdminOpsError extends Error {}

/* ── Names ─────────────────────────────────────────────────────────────── */

export async function namesForUsers(userIds: string[]): Promise<Record<string, { name: string; email: string | null; kind: 'provider' | 'customer' | 'user' }>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return {}
  const [{ data: us }, { data: pps }, { data: cps }] = await Promise.all([
    supabase.from('users').select('id, email').in('id', ids),
    supabase.from('provider_profiles').select('user_id, business_name, first_name, last_name').in('user_id', ids),
    supabase.from('customer_profiles').select('user_id, first_name, last_name').in('user_id', ids),
  ])
  const out: Record<string, { name: string; email: string | null; kind: 'provider' | 'customer' | 'user' }> = {}
  for (const u of us ?? []) out[u.id] = { name: u.email, email: u.email, kind: 'user' }
  for (const c of cps ?? []) { const n = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(); if (n) out[c.user_id] = { ...(out[c.user_id] ?? { email: null }), name: n, kind: 'customer' } }
  for (const p of pps ?? []) { const n = p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(); if (n) out[p.user_id] = { ...(out[p.user_id] ?? { email: null }), name: n, kind: 'provider' } }
  return out
}

/* ── Reviews ───────────────────────────────────────────────────────────── */

export async function listReviews(filter: 'all' | 'flagged' | 'hidden') {
  let q = supabase.from('reviews')
    .select('id, booking_id, reviewer_id, reviewee_id, rating, review_text, reviewer_name, is_flagged, flag_reason, flagged_at, hidden_at, hidden_reason, created_at, booking:bookings(booking_number, service:services(title))')
    .order('created_at', { ascending: false }).limit(300)
  if (filter === 'flagged') q = q.eq('is_flagged', true).is('hidden_at', null)
  if (filter === 'hidden') q = q.not('hidden_at', 'is', null)
  const { data, error } = await q
  if (error) throw error
  const names = await namesForUsers((data ?? []).flatMap(r => [r.reviewer_id, r.reviewee_id]))
  return (data ?? []).map(r => ({
    id: r.id, bookingId: r.booking_id, bookingNumber: (r.booking as any)?.booking_number ?? null, service: (r.booking as any)?.service?.title ?? null,
    rating: r.rating, text: r.review_text, createdAt: r.created_at,
    reviewer: { id: r.reviewer_id, name: r.reviewer_name || names[r.reviewer_id]?.name || 'Customer', email: names[r.reviewer_id]?.email ?? null, hasProfile: !!names[r.reviewer_id] },
    provider: { id: r.reviewee_id, name: names[r.reviewee_id]?.name ?? 'Provider' },
    flagged: !!r.is_flagged, flagReason: r.flag_reason, flaggedAt: r.flagged_at,
    hidden: !!r.hidden_at, hiddenAt: r.hidden_at, hiddenReason: r.hidden_reason,
  }))
}

export async function moderateReview(id: string, action: 'hide' | 'unhide' | 'delete' | 'clear_flag', actorId: string, reason: string) {
  const { data: r } = await supabase.from('reviews').select('id, hidden_at, is_flagged').eq('id', id).maybeSingle()
  if (!r) throw new AdminOpsError('Review not found')
  if (action === 'delete') {
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }
  const patch = action === 'hide' ? { hidden_at: new Date().toISOString(), hidden_by: actorId, hidden_reason: reason, is_flagged: false }
    : action === 'unhide' ? { hidden_at: null, hidden_by: null, hidden_reason: null }
    : { is_flagged: false, flag_reason: null }
  const { error } = await supabase.from('reviews').update(patch).eq('id', id)
  if (error) throw error
  return { deleted: false }
}

/* ── Bookings ──────────────────────────────────────────────────────────── */

export async function listBookings(opts: { status?: string | null; payment?: string | null; q?: string | null; limit?: number }) {
  let q = supabase.from('bookings')
    .select('id, booking_number, status, payment_status, scheduled_date, scheduled_time_start, total_amount, platform_fee, customer_confirmed_at, created_at, is_emergency, customer_id, provider_id, service:services(title), customer:customer_profiles(user_id, first_name, last_name), provider:provider_profiles(user_id, business_name, first_name, last_name)')
    .order('created_at', { ascending: false }).limit(opts.limit ?? 200)
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status)
  if (opts.payment && opts.payment !== 'all') q = q.eq('payment_status', opts.payment)
  if (opts.q?.trim()) q = q.ilike('booking_number', `%${opts.q.trim()}%`)
  const { data, error } = await q
  if (error) throw error
  const ids = (data ?? []).map(b => b.id)
  const { data: open } = ids.length ? await supabase.from('disputes').select('booking_id, dispute_number').in('booking_id', ids).in('status', OPEN_STATUSES as unknown as string[]) : { data: [] as any[] }
  const disputeBy = Object.fromEntries((open ?? []).map(d => [d.booking_id, d.dispute_number]))
  return (data ?? []).map(b => ({
    id: b.id, number: b.booking_number, status: b.status, paymentStatus: b.payment_status, date: b.scheduled_date, time: b.scheduled_time_start,
    total: Number(b.total_amount ?? 0), fee: Number(b.platform_fee ?? 0), confirmedAt: b.customer_confirmed_at, createdAt: b.created_at, emergency: !!b.is_emergency,
    service: (b.service as any)?.title ?? null,
    customer: b.customer ? { userId: (b.customer as any).user_id, name: `${(b.customer as any).first_name ?? ''} ${(b.customer as any).last_name ?? ''}`.trim() } : null,
    provider: b.provider ? { userId: (b.provider as any).user_id, name: (b.provider as any).business_name?.trim() || `${(b.provider as any).first_name ?? ''} ${(b.provider as any).last_name ?? ''}`.trim() } : null,
    openDispute: disputeBy[b.id] ?? null,
  }))
}

export async function bookingDetail(id: string) {
  const { data: b, error } = await supabase.from('bookings')
    .select('*, service:services(title, duration_minutes), customer:customer_profiles(id, user_id, first_name, last_name, profile_image_url), provider:provider_profiles(id, user_id, business_name, first_name, last_name, profile_image_url, stripe_account_status)')
    .eq('id', id).maybeSingle()
  if (error) throw error
  if (!b) return null
  const [payment, { data: disputes }, { data: photos }, { data: conv }, { data: audit }, { data: emailsTo }] = await Promise.all([
    latestPaymentForBooking(id),
    supabase.from('disputes').select('id, dispute_number, status, dispute_type, held_amount, resolution_type, filed_at').eq('booking_id', id).order('filed_at', { ascending: false }),
    supabase.from('booking_photos').select('id, storage_path, url, type, created_at').eq('booking_id', id).order('created_at'),
    supabase.from('conversations').select('id').eq('booking_id', id).maybeSingle(),
    supabase.from('admin_actions').select('id, actor_id, action, reason, created_at, after').eq('target_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('users').select('id, email').in('id', [(b.customer as any)?.user_id, (b.provider as any)?.user_id].filter(Boolean)),
  ])
  const emailBy = Object.fromEntries((emailsTo ?? []).map(u => [u.id, u.email]))
  const paths = (photos ?? []).map(p => p.storage_path ?? p.url).filter(Boolean) as string[]
  const signed: Record<string, string> = {}
  if (paths.length) { const { data } = await supabase.storage.from('booking-photos').createSignedUrls(paths, 900); for (const s of data ?? []) if (s.path && s.signedUrl) signed[s.path] = s.signedUrl }
  let chat: any[] = []
  if (conv?.id) { const { data: m } = await supabase.from('messages').select('id, sender_id, message_text, created_at').eq('conversation_id', conv.id).order('created_at').limit(200); chat = m ?? [] }
  return {
    booking: { ...b, service: b.service, customer: b.customer ? { ...(b.customer as any), email: emailBy[(b.customer as any).user_id] ?? null } : null, provider: b.provider ? { ...(b.provider as any), email: emailBy[(b.provider as any).user_id] ?? null } : null },
    payment, disputes: disputes ?? [],
    photos: (photos ?? []).map(p => ({ id: p.id, type: p.type, url: signed[(p.storage_path ?? p.url) as string] ?? null, createdAt: p.created_at })),
    chat: chat.map(m => ({ id: m.id, fromCustomer: m.sender_id === (b.customer as any)?.user_id, body: m.message_text, createdAt: m.created_at })),
    conversationId: conv?.id ?? null, audit: audit ?? [],
  }
}

export type BookingAction = 'cancel' | 'set_status' | 'resend_summary'

/** Admin booking actions. Service role → the lifecycle guard doesn't apply,
 *  which is the point: this is how a stuck booking gets unstuck. */
export async function actOnBooking(id: string, action: BookingAction, opts: { actorId: string; reason: string; status?: string; refund?: boolean }) {
  const { data: b } = await supabase.from('bookings').select('id, booking_number, status, payment_status, customer_confirmed_at, customer_id, provider_id, scheduled_date, scheduled_time_start, total_amount, admin_notes, service:services(title)').eq('id', id).maybeSingle()
  if (!b) throw new AdminOpsError('Booking not found')
  const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} admin] `
  const note = (b.admin_notes ? b.admin_notes + '\n' : '') + stamp + opts.reason

  if (action === 'cancel') {
    if (['cancelled', 'rejected'].includes(b.status)) throw new AdminOpsError('Already cancelled')
    const payment = await latestPaymentForBooking(id)
    let refunded: string | null = null
    if (opts.refund && payment && ['succeeded', 'partially_refunded'].includes(payment.payment_status)) {
      const r = await refundPayment(payment.id, { reason: `Admin cancellation ${b.booking_number}: ${opts.reason}`, actorUserId: opts.actorId })
      refunded = `${r.kind} ${poundsFromCents(r.amount)}`
    }
    // Dispatch releases any card hold and emails both sides
    const { error } = await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: opts.actorId, cancellation_reason: opts.reason, admin_notes: note }).eq('id', id)
    if (error) throw error
    return { outcome: `cancelled${refunded ? `, ${refunded}` : ''}` }
  }

  if (action === 'set_status') {
    const allowed = ['pending', 'accepted', 'in_progress', 'completed']
    if (!opts.status || !allowed.includes(opts.status)) throw new AdminOpsError('Choose a status')
    const patch: Record<string, unknown> = { status: opts.status, admin_notes: note }
    if (opts.status !== 'completed') patch.customer_confirmed_at = null
    if (opts.status === 'accepted' ) patch.accepted_at = new Date().toISOString()
    if (opts.status === 'in_progress') patch.started_at = new Date().toISOString()
    if (opts.status === 'completed') patch.completed_at = new Date().toISOString()
    const { error } = await supabase.from('bookings').update(patch).eq('id', id)
    if (error) throw error
    return { outcome: `status set to ${opts.status}${patch.customer_confirmed_at === null && b.customer_confirmed_at ? ' (confirmation cleared)' : ''}` }
  }

  // resend_summary: a plain "where this booking stands" email to both sides
  const [{ data: cp }, { data: pp }] = await Promise.all([
    supabase.from('customer_profiles').select('user_id').eq('id', b.customer_id).maybeSingle(),
    b.provider_id ? supabase.from('provider_profiles').select('user_id').eq('id', b.provider_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const service = escapeHtml((b.service as any)?.title ?? 'your booking')
  const when = b.scheduled_date ? `${ukDate(b.scheduled_date)}, ${ukTime(b.scheduled_time_start)}` : ''
  const details = [
    { label: 'Service', value: service }, ...(when ? [{ label: 'When', value: escapeHtml(when) }] : []),
    { label: 'Status', value: escapeHtml(String(b.status).replace('_', ' ')) }, { label: 'Payment', value: escapeHtml(String(b.payment_status ?? 'unpaid').replace('_', ' ')) },
    { label: 'Amount', value: poundsFromCents(Number(b.total_amount)) }, { label: 'Reference', value: escapeHtml(String(b.booking_number)) },
  ]
  let sent = 0
  for (const [uid, path] of [[cp?.user_id, `/bookings/${id}`], [pp?.user_id, `/provider/bookings/${id}`]] as const) {
    if (!uid) continue
    const { data: u } = await supabase.auth.admin.getUserById(uid)
    if (!u?.user?.email) continue
    await sendEmail(u.user.email, `Update on booking ${b.booking_number}`, renderNotificationEmail({
      heading: 'Where this booking stands', body: `Servios support has reviewed this booking. Here is its current state${opts.reason ? ':' : '.'}`,
      note: opts.reason ? escapeHtml(opts.reason) : undefined, details, ctaLabel: 'View booking', ctaPath: path, preheader: `${service} — ${String(b.status).replace('_', ' ')}`,
    }))
    sent++
  }
  await supabase.from('bookings').update({ admin_notes: note }).eq('id', id)
  return { outcome: `summary emailed to ${sent} ${sent === 1 ? 'person' : 'people'}` }
}

/* ── Users ─────────────────────────────────────────────────────────────── */

export async function searchUsers(opts: { q?: string | null; role?: string | null; status?: string | null; limit?: number }) {
  const q = opts.q?.trim() ?? ''
  const matchedIds = new Set<string>()
  if (q) {
    const like = `%${q}%`
    const [{ data: byEmail }, { data: byCp }, { data: byPp }, { data: byRef }] = await Promise.all([
      supabase.from('users').select('id').or(`email.ilike.${like},phone.ilike.${like}`).limit(100),
      supabase.from('customer_profiles').select('user_id').or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(100),
      supabase.from('provider_profiles').select('user_id').or(`first_name.ilike.${like},last_name.ilike.${like},business_name.ilike.${like}`).limit(100),
      supabase.from('bookings').select('customer:customer_profiles(user_id), provider:provider_profiles(user_id)').ilike('booking_number', like).limit(20),
    ])
    for (const u of byEmail ?? []) matchedIds.add(u.id)
    for (const c of byCp ?? []) matchedIds.add(c.user_id)
    for (const p of byPp ?? []) matchedIds.add(p.user_id)
    for (const b of byRef ?? []) { const c = (b.customer as any)?.user_id; const p = (b.provider as any)?.user_id; if (c) matchedIds.add(c); if (p) matchedIds.add(p) }
    if (matchedIds.size === 0) return []
  }
  let uq = supabase.from('users').select('id, email, phone, roles, active_role, status, created_at, last_login_at, suspended_at, closed_at').order('created_at', { ascending: false }).limit(opts.limit ?? 100)
  if (matchedIds.size) uq = uq.in('id', Array.from(matchedIds))
  if (opts.role && opts.role !== 'all') uq = uq.contains('roles', [opts.role])
  if (opts.status && opts.status !== 'all') uq = uq.eq('status', opts.status)
  const { data, error } = await uq
  if (error) throw error
  const names = await namesForUsers((data ?? []).map(u => u.id))
  return (data ?? []).map(u => ({ ...u, name: names[u.id]?.name && names[u.id]?.name !== u.email ? names[u.id].name : null }))
}

export async function userDetail(id: string) {
  const [{ data: u }, { data: cp }, { data: pp }, { data: auth }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).maybeSingle(),
    supabase.from('customer_profiles').select('*').eq('user_id', id).maybeSingle(),
    supabase.from('provider_profiles').select('id, business_name, first_name, last_name, profile_image_url, verification_status, rating_average, total_reviews, total_jobs_completed, stripe_account_status, trade_category, city, created_at').eq('user_id', id).maybeSingle(),
    supabase.auth.admin.getUserById(id),
  ])
  if (!u) return null
  const ors: string[] = []
  if (cp?.id) ors.push(`customer_id.eq.${cp.id}`)
  if (pp?.id) ors.push(`provider_id.eq.${pp.id}`)
  const [{ data: bookings }, { data: reviewsGiven }, { data: reviewsGot }, { data: disputes }, { data: audit }] = await Promise.all([
    ors.length ? supabase.from('bookings').select('id, booking_number, status, payment_status, scheduled_date, total_amount, created_at, customer_id, provider_id, service:services(title)').or(ors.join(',')).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
    supabase.from('reviews').select('id, rating, review_text, hidden_at, created_at, reviewee_id').eq('reviewer_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('reviews').select('id, rating, review_text, hidden_at, is_flagged, created_at, reviewer_name').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('disputes').select('id, dispute_number, status, dispute_type, resolution_type, filed_at, filed_by, filed_against').or(`filed_by.eq.${id},filed_against.eq.${id}`).order('filed_at', { ascending: false }).limit(20),
    supabase.from('admin_actions').select('id, action, reason, created_at, after').eq('target_id', id).order('created_at', { ascending: false }).limit(30),
  ])
  const bookingIds = (bookings ?? []).map(b => b.id)
  const { data: payments } = bookingIds.length ? await supabase.from('payments').select(PAYMENT_COLUMNS).in('booking_id', bookingIds) : { data: [] as any[] }
  const au = auth?.user
  return {
    user: { ...u, isAdmin: Array.isArray((au?.app_metadata as any)?.roles) && (au!.app_metadata as any).roles.includes('admin'), lastSignInAt: au?.last_sign_in_at ?? null, emailConfirmedAt: au?.email_confirmed_at ?? null, bannedUntil: (au as any)?.banned_until ?? null, authExists: !!au },
    customerProfile: cp ?? null, providerProfile: pp ?? null,
    bookings: (bookings ?? []).map(b => ({ ...b, role: cp?.id && b.customer_id === cp.id ? 'customer' : 'provider', service: (b.service as any)?.title ?? null })),
    payments: payments ?? [], reviewsGiven: reviewsGiven ?? [], reviewsReceived: reviewsGot ?? [], disputes: disputes ?? [], audit: audit ?? [],
  }
}

export type UserAction = 'suspend' | 'reinstate' | 'close' | 'reset_password' | 'note'

export async function actOnUser(id: string, action: UserAction, opts: { actorId: string; reason: string }) {
  const { data: u } = await supabase.from('users').select('id, email, status, roles, admin_notes').eq('id', id).maybeSingle()
  if (!u) throw new AdminOpsError('User not found')
  if (id === opts.actorId && (action === 'suspend' || action === 'close')) throw new AdminOpsError('You cannot suspend or close your own account')
  const stamp = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] `
  const notes = (u.admin_notes ? u.admin_notes + '\n' : '') + stamp + opts.reason

  switch (action) {
    case 'suspend': {
      // Ban in auth (blocks sign-in and token refresh) + mark the row
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })
      if (error) throw error
      await supabase.from('users').update({ status: 'suspended', suspended_at: new Date().toISOString(), suspension_reason: opts.reason, admin_notes: notes }).eq('id', id)
      await supabase.from('provider_profiles').update({ verification_status: 'pending', verification_notes: `Suspended: ${opts.reason}` }).eq('user_id', id).eq('verification_status', 'verified')
      return { outcome: 'suspended — sign-in blocked, provider profile hidden from search' }
    }
    case 'reinstate': {
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' })
      if (error) throw error
      await supabase.from('users').update({ status: 'active', suspended_at: null, suspension_reason: null, admin_notes: notes }).eq('id', id)
      return { outcome: 'reinstated — provider verification (if any) must be re-approved from the Verification queue' }
    }
    case 'close': {
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h', email: `closed+${id}@servios.invalid`, user_metadata: { closed: true } })
      if (error) throw error
      await supabase.from('users').update({ status: 'closed', closed_at: new Date().toISOString(), email: `closed+${id}@servios.invalid`, phone: null, admin_notes: notes }).eq('id', id)
      await supabase.from('customer_profiles').update({ first_name: 'Closed', last_name: 'account', profile_image_url: null }).eq('user_id', id)
      await supabase.from('provider_profiles').update({ first_name: 'Closed', last_name: 'account', business_name: 'Closed account', bio: null, phone: null, website: null, profile_image_url: null, verification_status: 'rejected', verification_notes: `Account closed: ${opts.reason}` }).eq('user_id', id)
      return { outcome: 'account closed — personal details removed, bookings and payments kept for records' }
    }
    case 'reset_password': {
      if (!u.email || u.email.endsWith('@servios.invalid')) throw new AdminOpsError('This account has no usable email')
      const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${(process.env.WEB_URL ?? 'https://servioswebnew.vercel.app').replace(/\/$/, '')}/auth/callback?next=/reset-password` })
      if (error) throw error
      await supabase.from('users').update({ admin_notes: notes }).eq('id', id)
      return { outcome: `password reset email sent to ${u.email}` }
    }
    case 'note': {
      await supabase.from('users').update({ admin_notes: notes }).eq('id', id)
      return { outcome: 'note saved' }
    }
  }
}
