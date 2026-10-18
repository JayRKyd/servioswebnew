import type Stripe from 'stripe'
import { supabase } from '../db/client'
import { getSettings } from './settings'
import {
  latestPaymentForBooking, paymentById, providerShareOf, splitKept, refundPayment, capturePayment,
  syncProviderShare, refreshProviderPayoutDelay, type PaymentRow,
} from './payments'

export const OPEN_STATUSES = ['open', 'under_review', 'awaiting_customer', 'awaiting_provider'] as const
export const DISPUTE_TYPES = {
  not_completed: 'Work not finished',
  poor_quality: 'Poor quality work',
  damage: 'Damage to property',
  no_show: 'Provider didn’t turn up',
  overcharged: 'Charged more than agreed',
  problem_after: 'Problem appeared after the job',
  other: 'Something else',
  chargeback: 'Bank chargeback',
} as const
export const DESIRED_OUTCOMES = {
  full_refund: 'Full refund',
  partial_refund: 'Partial refund',
  redo: 'Provider to put it right',
  other: 'Something else',
} as const
export type DisputeType = keyof typeof DISPUTE_TYPES
export type DesiredOutcome = keyof typeof DESIRED_OUTCOMES
export type Resolution = 'full_refund' | 'partial_refund' | 'release_to_provider' | 'no_action'

export class DisputeError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409 = 400) { super(message) }
}

const isOpen = (status: string | null | undefined) => (OPEN_STATUSES as readonly string[]).includes(status ?? '')

async function rateFor(bookingId: string): Promise<number> {
  const { data } = await supabase.from('bookings').select('commission_rate').eq('id', bookingId).maybeSingle()
  const raw = Number(data?.commission_rate ?? 0.12)
  return raw >= 1 ? raw / 100 : raw
}

interface BookingParties {
  booking: {
    id: string; booking_number: string | null; status: string; scheduled_date: string | null
    customer_confirmed_at: string | null; total_amount: number; customer_id: string | null; provider_id: string | null
  }
  customerUserId: string | null
  providerUserId: string | null
}

export async function loadBookingParties(bookingId: string): Promise<BookingParties | null> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_number, status, scheduled_date, customer_confirmed_at, total_amount, customer_id, provider_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return null
  const [{ data: cp }, { data: pp }] = await Promise.all([
    booking.customer_id ? supabase.from('customer_profiles').select('user_id').eq('id', booking.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    booking.provider_id ? supabase.from('provider_profiles').select('user_id').eq('id', booking.provider_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return { booking, customerUserId: cp?.user_id ?? null, providerUserId: pp?.user_id ?? null }
}

export interface Eligibility {
  allowed: boolean
  reason: string | null
  /** Last moment a dispute can be opened (ISO), when a window applies. */
  deadline: string | null
  openDisputeId: string | null
}

/** Can this customer report a problem on this booking right now? */
export async function disputeEligibility(bookingId: string, userId: string): Promise<Eligibility> {
  const parties = await loadBookingParties(bookingId)
  if (!parties) return { allowed: false, reason: 'Booking not found', deadline: null, openDisputeId: null }
  const { booking } = parties
  if (parties.customerUserId !== userId) return { allowed: false, reason: 'Only the customer can report a problem with this booking', deadline: null, openDisputeId: null }

  const { data: open } = await supabase
    .from('disputes').select('id').eq('booking_id', bookingId).in('status', OPEN_STATUSES as unknown as string[]).neq('source', 'chargeback').maybeSingle()
  if (open) return { allowed: false, reason: 'A problem report is already open for this booking', deadline: null, openDisputeId: open.id }

  if (!parties.providerUserId) return { allowed: false, reason: 'This booking has no provider', deadline: null, openDisputeId: null }

  const today = new Date().toISOString().slice(0, 10)
  const started = ['in_progress', 'completed'].includes(booking.status)
    || (booking.status === 'accepted' && !!booking.scheduled_date && booking.scheduled_date <= today)
  if (!started) return { allowed: false, reason: 'You can report a problem once the job date has arrived', deadline: null, openDisputeId: null }

  if (booking.customer_confirmed_at) {
    const { dispute_window_days } = await getSettings()
    const deadline = new Date(new Date(booking.customer_confirmed_at).getTime() + dispute_window_days * 86_400_000)
    if (Date.now() > deadline.getTime()) {
      return { allowed: false, reason: `Problems can be reported up to ${dispute_window_days} days after you confirm a job. Please contact support.`, deadline: deadline.toISOString(), openDisputeId: null }
    }
    return { allowed: true, reason: null, deadline: deadline.toISOString(), openDisputeId: null }
  }
  return { allowed: true, reason: null, deadline: null, openDisputeId: null }
}

/** The provider share to hold back for a disputed amount. */
function holdFor(payment: PaymentRow | null, disputedPence: number, rate: number): number {
  if (!payment) return 0
  const remaining = Number(payment.amount) - Number(payment.refund_amount ?? 0)
  const amount = Math.min(Math.max(0, disputedPence), remaining)
  return Math.min(providerShareOf(amount, rate), Number(payment.provider_payout_amount ?? 0))
}

export interface OpenDisputeInput {
  bookingId: string
  userId: string
  type: DisputeType
  description: string
  desiredOutcome: DesiredOutcome
  desiredAmountPence?: number | null
  evidencePaths?: string[]
}

export async function openDispute(input: OpenDisputeInput) {
  const eligibility = await disputeEligibility(input.bookingId, input.userId)
  if (!eligibility.allowed) throw new DisputeError(eligibility.reason ?? 'Not allowed', eligibility.openDisputeId ? 409 : 400)
  if (!(input.type in DISPUTE_TYPES) || input.type === 'chargeback') throw new DisputeError('Choose what went wrong')
  if (!(input.desiredOutcome in DESIRED_OUTCOMES)) throw new DisputeError('Choose what you would like to happen')
  if (input.description.trim().length < 20) throw new DisputeError('Please describe the problem in a little more detail (20 characters or more)')

  const parties = (await loadBookingParties(input.bookingId))!
  const payment = await latestPaymentForBooking(input.bookingId)
  const rate = await rateFor(input.bookingId)
  const remaining = payment ? Number(payment.amount) - Number(payment.refund_amount ?? 0) : Number(parties.booking.total_amount)

  let desiredAmount: number | null = null
  if (input.desiredOutcome === 'partial_refund') {
    desiredAmount = Math.round(Number(input.desiredAmountPence ?? 0))
    if (!(desiredAmount > 0) || desiredAmount > remaining) throw new DisputeError(`Enter an amount between £0.01 and £${(remaining / 100).toFixed(2)}`)
  } else if (input.desiredOutcome === 'full_refund') {
    desiredAmount = remaining
  }

  const evidence = (input.evidencePaths ?? []).filter(p => p.startsWith(`${input.userId}/`)).slice(0, 10)
  // Hold the provider's share of what's being claimed (all of it unless the
  // customer asked for a specific partial amount)
  const held = holdFor(payment, desiredAmount ?? remaining, rate)

  const { data: dispute, error } = await supabase.from('disputes').insert({
    booking_id: input.bookingId,
    payment_id: payment?.id ?? null,
    filed_by: input.userId,
    filed_against: parties.providerUserId,
    dispute_type: input.type,
    dispute_reason: input.description.trim(),
    desired_outcome: input.desiredOutcome,
    desired_amount: desiredAmount,
    evidence_urls: evidence,
    status: 'open',
    priority: parties.booking.customer_confirmed_at ? 'normal' : 'high',
    held_amount: held,
    source: 'customer',
  }).select('*').single()
  if (error) {
    if (error.code === '23505') throw new DisputeError('A problem report is already open for this booking', 409)
    throw error
  }

  if (payment) {
    try { await syncProviderShare(payment.id) } catch (e) { console.error('hold on dispute open failed:', e) }
  }
  return dispute
}

export async function addDisputeMessage(opts: {
  disputeId: string; senderId: string | null; role: 'customer' | 'provider' | 'admin' | 'system'
  body: string; visibleTo?: 'all' | 'customer' | 'provider' | 'admin'; attachments?: string[]
}) {
  const body = opts.body.trim()
  if (!body) throw new DisputeError('Message is empty')
  const attachments = (opts.attachments ?? []).filter(p => !opts.senderId || opts.role === 'admin' || p.startsWith(`${opts.senderId}/`)).slice(0, 10)
  const { data, error } = await supabase.from('dispute_messages').insert({
    dispute_id: opts.disputeId,
    sender_id: opts.senderId,
    sender_role: opts.role,
    body,
    attachments,
    visible_to: opts.visibleTo ?? 'all',
  }).select('*').single()
  if (error) throw error

  if (opts.role === 'provider') {
    const { data: d } = await supabase.from('disputes').select('provider_response, status').eq('id', opts.disputeId).maybeSingle()
    const patch: Record<string, unknown> = {}
    if (!d?.provider_response) { patch.provider_response = body; patch.provider_responded_at = new Date().toISOString() }
    if (d?.status === 'awaiting_provider') patch.status = 'under_review'
    if (Object.keys(patch).length) await supabase.from('disputes').update(patch).eq('id', opts.disputeId)
  } else if (opts.role === 'customer') {
    const { data: d } = await supabase.from('disputes').select('status').eq('id', opts.disputeId).maybeSingle()
    if (d?.status === 'awaiting_customer') await supabase.from('disputes').update({ status: 'under_review' }).eq('id', opts.disputeId)
  }
  return data
}

export interface ResolveInput {
  disputeId: string
  actorId: string
  outcome: Resolution
  amountPence?: number | null
  notes: string
}

/** Money first (while the hold is still in place), then close the dispute and
 *  resync so the provider ends with exactly their share of what was kept. */
export async function resolveDispute(input: ResolveInput) {
  const { data: dispute } = await supabase.from('disputes').select('*').eq('id', input.disputeId).maybeSingle()
  if (!dispute) throw new DisputeError('Dispute not found', 404)
  if (!isOpen(dispute.status)) throw new DisputeError('This dispute is already closed', 409)
  if (!input.notes.trim()) throw new DisputeError('Add a note explaining the decision — both sides see it')

  const payment = dispute.payment_id ? await paymentById(dispute.payment_id) : await latestPaymentForBooking(dispute.booking_id)
  let refunded = 0

  switch (input.outcome) {
    case 'full_refund':
    case 'partial_refund': {
      if (!payment || ['cancelled', 'failed'].includes(payment.payment_status)) throw new DisputeError('There is no payment on this booking to refund')
      const remaining = Number(payment.amount) - Number(payment.refund_amount ?? 0)
      const amount = input.outcome === 'full_refund' ? remaining : Math.round(Number(input.amountPence ?? 0))
      if (!(amount > 0) || amount > remaining) throw new DisputeError(`Refund must be between £0.01 and £${(remaining / 100).toFixed(2)}`)
      if (input.outcome === 'partial_refund' && amount === remaining) throw new DisputeError('That’s the full amount — choose Full refund instead')
      await refundPayment(payment.id, { amountPence: amount, reason: `Dispute ${dispute.dispute_number}: ${input.notes.trim()}`, actorUserId: input.actorId })
      refunded = amount
      break
    }
    case 'release_to_provider': {
      if (payment?.payment_status === 'authorized') {
        // The customer never confirmed — the decision stands in for it
        const now = new Date().toISOString()
        await supabase.from('bookings').update({ status: 'completed', completed_at: now, customer_confirmed_at: now }).eq('id', dispute.booking_id).is('customer_confirmed_at', null)
        await capturePayment(dispute.booking_id)
      }
      break
    }
    case 'no_action':
      break
    default:
      throw new DisputeError('Unknown outcome')
  }

  const { data: updated, error } = await supabase.from('disputes').update({
    status: 'resolved',
    resolution_type: input.outcome,
    resolution_notes: input.notes.trim(),
    resolution_amount: refunded || null,
    refund_amount: refunded || null,
    resolved_by: input.actorId,
    resolved_at: new Date().toISOString(),
    held_amount: 0,
  }).eq('id', input.disputeId).select('*').single()
  if (error) throw error

  if (payment) {
    try { await syncProviderShare(payment.id) } catch (e) { console.error('release after resolution failed:', e) }
  }
  const { data: b } = await supabase.from('bookings').select('provider_id').eq('id', dispute.booking_id).maybeSingle()
  if (b?.provider_id) {
    try { await refreshProviderPayoutDelay(b.provider_id) } catch (e) { console.error('payout delay refresh failed:', e) }
  }
  return { dispute: updated, refunded }
}

/** What each side ends up with for a proposed resolution — the admin screen
 *  shows this before the button is pressed. */
export function previewResolution(payment: PaymentRow | null, rate: number, outcome: Resolution, amountPence?: number | null) {
  if (!payment) return null
  const original = Number(payment.amount)
  const alreadyRefunded = Number(payment.refund_amount ?? 0)
  const remaining = original - alreadyRefunded
  const refund = outcome === 'full_refund' ? remaining
    : outcome === 'partial_refund' ? Math.min(Math.max(0, Math.round(Number(amountPence ?? 0))), remaining)
    : 0
  const kept = original - alreadyRefunded - refund
  const split = splitKept(kept, rate)
  return { original, alreadyRefunded, refund, customerPays: kept, providerGets: split.providerShare, serviosKeeps: split.commission }
}

/* ── Bank chargebacks (charge.dispute.*) ─────────────────────────────────── */

export async function handleChargebackEvent(type: string, sd: Stripe.Dispute): Promise<string> {
  const chargeId = typeof sd.charge === 'string' ? sd.charge : sd.charge.id
  const { data: payment } = await supabase.from('payments').select('id, booking_id, amount, refund_amount, provider_payout_amount, payer_id').eq('stripe_charge_id', chargeId).maybeSingle()
  if (!payment) return 'no matching payment'
  const { data: existing } = await supabase.from('disputes').select('*').eq('stripe_dispute_id', sd.id).maybeSingle()

  if (type === 'charge.dispute.created') {
    if (existing) return 'already recorded'
    const parties = await loadBookingParties(payment.booking_id)
    const rate = await rateFor(payment.booking_id)
    const held = Math.min(providerShareOf(sd.amount, rate), Number(payment.provider_payout_amount ?? 0))
    const respondBy = sd.evidence_details?.due_by ? new Date(sd.evidence_details.due_by * 1000).toISOString() : null
    await supabase.from('disputes').insert({
      booking_id: payment.booking_id,
      payment_id: payment.id,
      filed_by: parties?.customerUserId ?? payment.payer_id,
      filed_against: parties?.providerUserId,
      dispute_type: 'chargeback',
      dispute_reason: `The customer's bank opened a chargeback (${sd.reason.replace(/_/g, ' ')}) for £${(sd.amount / 100).toFixed(2)}.${respondBy ? ` Evidence due to Stripe by ${respondBy.slice(0, 10)}.` : ''}`,
      desired_outcome: 'full_refund',
      desired_amount: sd.amount,
      status: 'open',
      priority: 'urgent',
      held_amount: held,
      source: 'chargeback',
      stripe_dispute_id: sd.id,
    })
    await syncProviderShare(payment.id)
    return 'chargeback opened'
  }

  if (type === 'charge.dispute.closed' && existing && isOpen(existing.status)) {
    const won = sd.status === 'won'
    if (!won) {
      // Bank took the money back: treat as a refund of the disputed amount
      const refunded = Number(payment.refund_amount ?? 0) + sd.amount
      const status = refunded >= Number(payment.amount) ? 'refunded' : 'partially_refunded'
      const split = splitKept(Number(payment.amount) - refunded, await rateFor(payment.booking_id))
      await supabase.from('payments').update({
        payment_status: status, refund_amount: refunded, refunded_at: new Date().toISOString(),
        platform_fee_amount: split.commission, provider_payout_amount: split.providerShare,
      }).eq('id', payment.id)
      await supabase.from('bookings').update({ payment_status: status }).eq('id', payment.booking_id)
    }
    await supabase.from('disputes').update({
      status: 'resolved',
      resolution_type: won ? 'chargeback_won' : 'chargeback_lost',
      resolution_notes: won ? 'The bank ruled in Servios’s favour — the payment stands.' : 'The bank ruled for the customer — the disputed amount was returned to them.',
      resolution_amount: won ? null : sd.amount,
      refund_amount: won ? null : sd.amount,
      resolved_at: new Date().toISOString(),
      held_amount: 0,
    }).eq('id', existing.id)
    await syncProviderShare(payment.id)
    return won ? 'chargeback won' : 'chargeback lost'
  }
  return 'recorded'
}
