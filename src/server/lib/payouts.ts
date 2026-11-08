import { supabase } from '../db/client'
import { getSettings } from './settings'
import { syncProviderShare, PAYMENT_COLUMNS } from './payments'
import { OPEN_STATUSES } from './disputes'

/**
 * Admin payout oversight. A captured payment's provider share is in one of:
 *   held      — an open dispute holds part/all of it
 *   owed      — captured, not yet paid to the provider
 *   clearing  — transferred to the provider's Stripe balance, bank date ahead
 *   paid_out  — reached the provider (Stripe payout past clearing, or a
 *               manual payout the team recorded)
 */
export type PayoutState = 'held' | 'owed' | 'clearing' | 'paid_out' | 'refunded'

export interface PayoutRow {
  paymentId: string
  bookingId: string
  bookingNumber: string | null
  service: string | null
  customerName: string
  scheduledDate: string | null
  capturedAt: string | null
  gross: number
  refunded: number
  commission: number
  net: number
  held: number
  transferred: number
  releasedAt: string | null
  payoutMethod: string | null
  payoutReference: string | null
  clearsOn: string | null
  state: PayoutState
  disputeNumber: string | null
}

export interface ProviderPayouts {
  profileId: string
  userId: string
  name: string
  email: string | null
  avatarUrl: string | null
  connect: 'active' | 'pending' | 'restricted' | 'not_connected'
  payoutDelayDays: number
  owed: number
  held: number
  clearing: number
  paidOut: number
  payments: PayoutRow[]
}

export async function loadPayouts(): Promise<{ providers: ProviderPayouts[]; totals: { owed: number; held: number; clearing: number; paidOut: number; commission: number } }> {
  const settings = await getSettings()
  const [{ data: payments, error }, { data: disputes }] = await Promise.all([
    supabase.from('payments')
      .select(`${PAYMENT_COLUMNS}, payout_method, payout_reference, released_by, booking:bookings!inner(id, booking_number, provider_id, customer_id, scheduled_date, service:services(title))`)
      .in('payment_status', ['succeeded', 'partially_refunded', 'refunded'])
      .order('captured_at', { ascending: false })
      .limit(1000),
    supabase.from('disputes').select('booking_id, dispute_number, held_amount').in('status', OPEN_STATUSES as unknown as string[]),
  ])
  if (error) throw error

  const holdByBooking: Record<string, { amount: number; number: string }> = {}
  for (const d of disputes ?? []) {
    const cur = holdByBooking[d.booking_id] ?? { amount: 0, number: d.dispute_number }
    holdByBooking[d.booking_id] = { amount: cur.amount + Number(d.held_amount ?? 0), number: d.dispute_number }
  }

  const providerIds = Array.from(new Set((payments ?? []).map((p: any) => p.booking?.provider_id).filter(Boolean))) as string[]
  const customerIds = Array.from(new Set((payments ?? []).map((p: any) => p.booking?.customer_id).filter(Boolean))) as string[]
  const [{ data: profiles }, { data: customers }] = await Promise.all([
    providerIds.length ? supabase.from('provider_profiles').select('id, user_id, business_name, first_name, last_name, profile_image_url, stripe_account_status, payout_delay_days').in('id', providerIds) : Promise.resolve({ data: [] as any[] }),
    customerIds.length ? supabase.from('customer_profiles').select('id, first_name, last_name').in('id', customerIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const userIds = (profiles ?? []).map(p => p.user_id)
  const { data: users } = userIds.length ? await supabase.from('users').select('id, email').in('id', userIds) : { data: [] as any[] }
  const emailByUser = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  const customerById = Object.fromEntries((customers ?? []).map(c => [c.id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Customer']))

  const byProvider: Record<string, ProviderPayouts> = {}
  for (const p of profiles ?? []) {
    byProvider[p.id] = {
      profileId: p.id, userId: p.user_id,
      name: p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Provider',
      email: emailByUser[p.user_id] ?? null,
      avatarUrl: p.profile_image_url ?? null,
      connect: (p.stripe_account_status as ProviderPayouts['connect']) ?? 'not_connected',
      payoutDelayDays: Number(p.payout_delay_days ?? settings.payout_delay_days),
      owed: 0, held: 0, clearing: 0, paidOut: 0, payments: [],
    }
  }

  const totals = { owed: 0, held: 0, clearing: 0, paidOut: 0, commission: 0 }
  for (const p of (payments ?? []) as any[]) {
    const prov = byProvider[p.booking?.provider_id]
    if (!prov) continue
    const gross = Number(p.amount ?? 0)
    const refunded = Number(p.refund_amount ?? 0)
    const commission = Number(p.platform_fee_amount ?? 0)
    const net = Number(p.provider_payout_amount ?? 0)
    const hold = holdByBooking[p.booking_id]
    const held = Math.min(hold?.amount ?? 0, net)
    const transferred = Number(p.transferred_amount ?? 0) - Number(p.reversed_amount ?? 0)
    const connected = prov.connect === 'active'
    const clearsOn = p.captured_at ? new Date(new Date(p.captured_at).getTime() + prov.payoutDelayDays * 86_400_000) : null
    const manual = !!p.payout_method && p.payout_method !== 'stripe'

    let state: PayoutState
    if (net <= 0 && refunded >= gross) state = 'refunded'
    else if (held > 0) state = 'held'
    else if (manual) state = 'paid_out'
    else if (connected && transferred >= net && net > 0) state = clearsOn && clearsOn.getTime() > Date.now() ? 'clearing' : 'paid_out'
    else state = 'owed'

    const row: PayoutRow = {
      paymentId: p.id, bookingId: p.booking_id, bookingNumber: p.booking?.booking_number ?? null,
      service: p.booking?.service?.title ?? null, customerName: customerById[p.booking?.customer_id] ?? 'Customer',
      scheduledDate: p.booking?.scheduled_date ?? null, capturedAt: p.captured_at ?? null,
      gross, refunded, commission, net, held, transferred,
      releasedAt: p.released_at ?? null, payoutMethod: p.payout_method ?? null, payoutReference: p.payout_reference ?? null,
      clearsOn: clearsOn?.toISOString() ?? null, state, disputeNumber: hold?.number ?? null,
    }
    prov.payments.push(row)
    totals.commission += commission
    const free = Math.max(0, net - held)
    if (state === 'held') { prov.held += held; totals.held += held; prov.owed += free; totals.owed += free }
    else if (state === 'owed') { prov.owed += net; totals.owed += net }
    else if (state === 'clearing') { prov.clearing += net; totals.clearing += net }
    else if (state === 'paid_out') { prov.paidOut += net; totals.paidOut += net }
  }

  const providers = Object.values(byProvider)
    .filter(p => p.payments.length > 0)
    .sort((a, b) => (b.owed + b.held) - (a.owed + a.held) || a.name.localeCompare(b.name))
  return { providers, totals }
}

/** Record that the team paid the provider for these payments (bank transfer
 *  outside Stripe), or push the Stripe transfer for a connected provider. */
export async function releasePayments(opts: { paymentIds: string[]; actorId: string; method: 'manual' | 'stripe'; reference?: string | null; notes?: string | null; overrideHold?: boolean }) {
  const { data: rows, error } = await supabase.from('payments').select(`${PAYMENT_COLUMNS}, payout_method, booking:bookings(booking_id:id, provider_id)`).in('id', opts.paymentIds)
  if (error) throw error
  const results: { paymentId: string; outcome: string }[] = []
  for (const p of (rows ?? []) as any[]) {
    if (!['succeeded', 'partially_refunded'].includes(p.payment_status)) { results.push({ paymentId: p.id, outcome: `skipped: payment is ${p.payment_status}` }); continue }
    if (p.payout_method && p.payout_method !== 'stripe') { results.push({ paymentId: p.id, outcome: 'already recorded as paid out' }); continue }
    const { data: open } = await supabase.from('disputes').select('dispute_number').eq('booking_id', p.booking_id).in('status', OPEN_STATUSES as unknown as string[]).limit(1).maybeSingle()
    if (open && !opts.overrideHold) { results.push({ paymentId: p.id, outcome: `skipped: open dispute ${open.dispute_number}` }); continue }

    if (opts.method === 'stripe') {
      const sync = await syncProviderShare(p.id)
      results.push({ paymentId: p.id, outcome: sync.mode === 'stripe' ? `transferred ${sync.moved}p (net ${sync.net}p)` : `no Stripe account — ${sync.mode}` })
      continue
    }
    await supabase.from('payments').update({
      payout_method: 'manual',
      payout_reference: opts.reference ?? null,
      released_at: new Date().toISOString(),
      released_by: opts.actorId,
    }).eq('id', p.id)
    results.push({ paymentId: p.id, outcome: 'recorded as paid out manually' })
  }
  return results
}
