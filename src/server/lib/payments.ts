import type Stripe from 'stripe'
import { supabase } from '../db/client'
import { stripe } from './stripe'

/**
 * Payment lifecycle (separate charges & transfers — the Connect model the
 * client picked: Servios collects, holds, and pays the provider out):
 *
 *   accepted  → customer authorises card   PaymentIntent, manual capture   payment_status=authorized
 *   confirmed → platform captures           money lands in Servios balance   payment_status=paid
 *   released  → admin (Phase 3) transfers   total − platform_fee to provider transfer_id set
 *   refund    → refunds.create (+ transfer reversal if already released)
 *
 * Amounts are pence throughout (bookings.total_amount is stored in pence).
 * Without STRIPE_SECRET_KEY everything runs in simulation (sim_ intents).
 */

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY?.trim()
export const isSimulatedIntent = (id?: string | null) => !!id && id.startsWith('sim_')

export interface PaymentRow {
  id: string
  booking_id: string
  payment_intent_id: string | null
  amount: number
  currency: string | null
  payment_status: string
  payment_method: string | null
  payer_id: string | null
  stripe_charge_id: string | null
  transfer_id: string | null
  refund_id: string | null
  refund_amount: number | null
  platform_fee_amount: number | null
  provider_payout_amount: number | null
  captured_at: string | null
  paid_at: string | null
  released_at: string | null
  created_at: string
}

export interface PayableBooking {
  id: string
  booking_number: string | null
  customer_id: string | null
  provider_id: string | null
  landlord_id: string | null
  payer_id: string | null
  status: string
  total_amount: number
  platform_fee: number | null
  customer_confirmed_at: string | null
  payment_status: string | null
}

export const PAYMENT_COLUMNS = 'id, booking_id, payment_intent_id, amount, currency, payment_status, payment_method, payer_id, stripe_charge_id, transfer_id, refund_id, refund_amount, platform_fee_amount, provider_payout_amount, captured_at, paid_at, released_at, created_at'

export async function latestPaymentForBooking(bookingId: string): Promise<PaymentRow | null> {
  const { data } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as PaymentRow | null) ?? null
}

export async function paymentById(paymentId: string): Promise<PaymentRow | null> {
  const { data } = await supabase.from('payments').select(PAYMENT_COLUMNS).eq('id', paymentId).maybeSingle()
  return (data as PaymentRow | null) ?? null
}

/** The booking plus every user id allowed to pay for it (customer, landlord,
 *  explicit payer). Web bookings never set payer_id, so the customer profile
 *  is resolved here rather than trusted on the row. */
export async function loadPayableBooking(bookingId: string): Promise<{ booking: PayableBooking; payerUserIds: string[] } | null> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_number, customer_id, provider_id, landlord_id, payer_id, status, total_amount, platform_fee, customer_confirmed_at, payment_status')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return null
  const ids = new Set<string>()
  if (booking.payer_id) ids.add(booking.payer_id)
  if (booking.landlord_id) ids.add(booking.landlord_id)
  if (booking.customer_id) {
    const { data: cp } = await supabase.from('customer_profiles').select('user_id').eq('id', booking.customer_id).maybeSingle()
    if (cp?.user_id) ids.add(cp.user_id)
  }
  return { booking: booking as PayableBooking, payerUserIds: Array.from(ids) }
}

async function setBookingPaymentStatus(bookingId: string, status: string) {
  const { error } = await supabase.from('bookings').update({ payment_status: status }).eq('id', bookingId)
  if (error) console.error('bookings.payment_status update failed:', error.message)
}

async function updatePayment(paymentId: string, patch: Record<string, unknown>): Promise<PaymentRow | null> {
  const { data, error } = await supabase.from('payments').update(patch).eq('id', paymentId).select(PAYMENT_COLUMNS).maybeSingle()
  if (error) throw error
  return (data as PaymentRow | null) ?? null
}

export async function markAuthorized(payment: PaymentRow): Promise<PaymentRow> {
  if (payment.payment_status === 'authorized' || payment.payment_status === 'succeeded') return payment
  const updated = await updatePayment(payment.id, { payment_status: 'authorized' })
  await setBookingPaymentStatus(payment.booking_id, 'authorized')
  return updated ?? { ...payment, payment_status: 'authorized' }
}

export interface IntentResult {
  paymentId: string
  clientSecret: string | null
  simulated: boolean
  status: string
}

/** Create a manual-capture PaymentIntent for a booking, or hand back the one
 *  already in flight so a refresh mid-checkout doesn't orphan intents. */
export async function createOrReuseIntent(booking: PayableBooking, payerUserId: string): Promise<IntentResult> {
  const amount = Math.round(Number(booking.total_amount))
  const fee = Math.round(Number(booking.platform_fee ?? 0))
  if (!(amount > 0)) throw new Error('This booking has no amount to pay')

  const existing = await latestPaymentForBooking(booking.id)
  if (existing && ['authorized', 'succeeded'].includes(existing.payment_status)) {
    return { paymentId: existing.id, clientSecret: null, simulated: isSimulatedIntent(existing.payment_intent_id), status: existing.payment_status }
  }

  if (!stripeConfigured()) {
    // Simulation — no key configured (local dev). Authorised immediately.
    const simId = `sim_${crypto.randomUUID()}`
    const { data, error } = await supabase.from('payments').insert({
      booking_id: booking.id,
      payment_intent_id: simId,
      amount,
      currency: 'GBP',
      payment_status: 'authorized',
      payment_method: 'simulated',
      payer_id: payerUserId,
      capture_method: 'manual',
      platform_fee_amount: fee,
      provider_payout_amount: amount - fee,
    }).select('id').single()
    if (error) throw error
    await setBookingPaymentStatus(booking.id, 'authorized')
    return { paymentId: data.id, clientSecret: null, simulated: true, status: 'authorized' }
  }

  if (amount < 30) throw new Error('Card payments must be at least £0.30')

  // A pending real intent that is still confirmable is reused as-is
  if (existing && existing.payment_status === 'pending' && existing.payment_intent_id && !isSimulatedIntent(existing.payment_intent_id)) {
    try {
      const pi = await stripe.paymentIntents.retrieve(existing.payment_intent_id)
      if (pi.status === 'requires_capture') {
        const authorised = await markAuthorized(existing)
        return { paymentId: authorised.id, clientSecret: null, simulated: false, status: 'authorized' }
      }
      if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(pi.status) && pi.amount === amount) {
        return { paymentId: existing.id, clientSecret: pi.client_secret, simulated: false, status: 'pending' }
      }
    } catch (e) {
      console.error('retrieve existing intent failed, creating a new one:', e)
    }
  }

  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'gbp',
    capture_method: 'manual',
    payment_method_types: ['card'],
    description: `Servios booking ${booking.booking_number ?? booking.id}`,
    metadata: {
      booking_id: booking.id,
      booking_number: booking.booking_number ?? '',
      payer_user_id: payerUserId,
      provider_profile_id: booking.provider_id ?? '',
      platform_fee: String(fee),
    },
  })

  const { data, error } = await supabase.from('payments').insert({
    booking_id: booking.id,
    payment_intent_id: pi.id,
    amount,
    currency: 'GBP',
    payment_status: 'pending',
    payment_method: 'card',
    payer_id: payerUserId,
    capture_method: 'manual',
    platform_fee_amount: fee,
    provider_payout_amount: amount - fee,
    payment_metadata: { livemode: pi.livemode },
  }).select('id').single()
  if (error) throw error
  await setBookingPaymentStatus(booking.id, 'pending')

  return { paymentId: data.id, clientSecret: pi.client_secret, simulated: false, status: 'pending' }
}

/** Pull the live PaymentIntent state into our row — called right after the
 *  customer confirms on the client so the UI doesn't wait on the webhook. */
export async function syncIntentStatus(payment: PaymentRow): Promise<PaymentRow> {
  if (!payment.payment_intent_id || isSimulatedIntent(payment.payment_intent_id)) return payment
  const pi = await stripe.paymentIntents.retrieve(payment.payment_intent_id)
  return applyIntentState(payment, pi)
}

async function applyIntentState(payment: PaymentRow, pi: Stripe.PaymentIntent): Promise<PaymentRow> {
  switch (pi.status) {
    case 'requires_capture':
      return markAuthorized(payment)
    case 'succeeded': {
      if (payment.payment_status === 'succeeded') return payment
      const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null
      const now = new Date().toISOString()
      const updated = await updatePayment(payment.id, { payment_status: 'succeeded', captured_at: payment.captured_at ?? now, paid_at: payment.paid_at ?? now, stripe_charge_id: chargeId })
      await setBookingPaymentStatus(payment.booking_id, 'paid')
      return updated ?? payment
    }
    case 'canceled': {
      if (payment.payment_status === 'cancelled') return payment
      const updated = await updatePayment(payment.id, { payment_status: 'cancelled', failure_reason: pi.cancellation_reason ?? null })
      await setBookingPaymentStatus(payment.booking_id, 'unpaid')
      return updated ?? payment
    }
    case 'requires_payment_method': {
      if (pi.last_payment_error) {
        const updated = await updatePayment(payment.id, { payment_status: 'failed', failure_reason: pi.last_payment_error.message ?? pi.last_payment_error.code ?? 'declined' })
        await setBookingPaymentStatus(payment.booking_id, 'failed')
        return updated ?? payment
      }
      return payment
    }
    default:
      return payment
  }
}

/** Capture the held funds. Only after the customer has confirmed completion
 *  (the escrow gate) — callers check that. */
export async function capturePayment(bookingId: string): Promise<PaymentRow | null> {
  const payment = await latestPaymentForBooking(bookingId)
  if (!payment) return null
  if (payment.payment_status === 'succeeded') return payment
  if (payment.payment_status !== 'authorized') throw new Error(`Payment is ${payment.payment_status}, not authorised`)

  const now = new Date().toISOString()
  let chargeId: string | null = payment.stripe_charge_id
  if (!isSimulatedIntent(payment.payment_intent_id) && payment.payment_intent_id) {
    const pi = await stripe.paymentIntents.capture(payment.payment_intent_id)
    chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null
  }
  const updated = await updatePayment(payment.id, { payment_status: 'succeeded', captured_at: now, paid_at: now, stripe_charge_id: chargeId })
  await setBookingPaymentStatus(bookingId, 'paid')
  return updated
}

/** Release a card hold that will never be captured (booking cancelled or
 *  declined). Safe to call when there is nothing to release. */
export async function cancelHeldPayment(bookingId: string, reason: string): Promise<PaymentRow | null> {
  const payment = await latestPaymentForBooking(bookingId)
  if (!payment || !['pending', 'authorized'].includes(payment.payment_status)) return payment
  if (!isSimulatedIntent(payment.payment_intent_id) && payment.payment_intent_id && stripeConfigured()) {
    try {
      await stripe.paymentIntents.cancel(payment.payment_intent_id, { cancellation_reason: 'requested_by_customer' })
    } catch (e: any) {
      // Already cancelled / never confirmed — nothing to undo
      if (e?.code !== 'payment_intent_unexpected_state') throw e
    }
  }
  const updated = await updatePayment(payment.id, { payment_status: 'cancelled', failure_reason: reason })
  await setBookingPaymentStatus(bookingId, 'unpaid')
  return updated
}

export interface RefundResult {
  kind: 'cancelled' | 'refunded' | 'partially_refunded'
  payment: PaymentRow
  refundId: string | null
  reversalId: string | null
  amount: number
}

/** Refund a captured payment (full or partial). If the provider has already
 *  been paid out, their proportional share is reversed from the transfer. */
export async function refundPayment(paymentId: string, opts: { amountPence?: number; reason: string; actorUserId: string }): Promise<RefundResult> {
  const payment = await paymentById(paymentId)
  if (!payment) throw new Error('Payment not found')

  if (['pending', 'authorized'].includes(payment.payment_status)) {
    const cancelled = await cancelHeldPayment(payment.booking_id, opts.reason)
    return { kind: 'cancelled', payment: cancelled ?? payment, refundId: null, reversalId: null, amount: Number(payment.amount) }
  }
  if (!['succeeded', 'partially_refunded'].includes(payment.payment_status)) {
    throw new Error(`Payment is ${payment.payment_status} and cannot be refunded`)
  }

  const alreadyRefunded = Number(payment.refund_amount ?? 0)
  const remaining = Number(payment.amount) - alreadyRefunded
  const amount = opts.amountPence != null ? Math.round(opts.amountPence) : remaining
  if (!(amount > 0) || amount > remaining) throw new Error(`Refund must be between £0.01 and £${(remaining / 100).toFixed(2)}`)

  let refundId: string | null = null
  let reversalId: string | null = null
  if (!isSimulatedIntent(payment.payment_intent_id) && payment.payment_intent_id) {
    const refund = await stripe.refunds.create({
      payment_intent: payment.payment_intent_id,
      amount,
      reason: 'requested_by_customer',
      metadata: { booking_id: payment.booking_id, payment_id: payment.id, actor: opts.actorUserId, note: opts.reason.slice(0, 450) },
    })
    refundId = refund.id
    if (payment.transfer_id && payment.provider_payout_amount) {
      const share = Math.round(amount * (Number(payment.provider_payout_amount) / Number(payment.amount)))
      if (share > 0) {
        const reversal = await stripe.transfers.createReversal(payment.transfer_id, { amount: share, metadata: { refund_id: refund.id } })
        reversalId = reversal.id
      }
    }
  }

  const total = alreadyRefunded + amount
  const status = total >= Number(payment.amount) ? 'refunded' : 'partially_refunded'
  const updated = await updatePayment(payment.id, {
    payment_status: status,
    refund_id: refundId ?? payment.refund_id,
    refund_amount: total,
    refunded_at: new Date().toISOString(),
  })
  await setBookingPaymentStatus(payment.booking_id, status)
  return { kind: status, payment: updated ?? payment, refundId, reversalId, amount }
}

/* ── Webhooks ─────────────────────────────────────────────────────────────── */

/** Verify against the platform secret, then the Connect endpoint's secret. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .map(s => s?.trim())
    .filter((s): s is string => !!s)
  if (secrets.length === 0) throw new Error('No webhook secret configured')
  let lastError: unknown
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

/** Record the event id first so a Stripe retry can't apply it twice. */
export async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const { error } = await supabase.from('stripe_events').insert({ id: event.id, type: event.type, livemode: event.livemode })
  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

export async function finishStripeEvent(eventId: string, err?: unknown) {
  await supabase.from('stripe_events').update({
    processed_at: new Date().toISOString(),
    error: err ? (err instanceof Error ? err.message : String(err)).slice(0, 500) : null,
  }).eq('id', eventId)
}

async function paymentByIntent(intentId: string): Promise<PaymentRow | null> {
  const { data } = await supabase.from('payments').select(PAYMENT_COLUMNS).eq('payment_intent_id', intentId).maybeSingle()
  return (data as PaymentRow | null) ?? null
}

export async function applyStripeEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case 'payment_intent.amount_capturable_updated':
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const pi = event.data.object as Stripe.PaymentIntent
      const payment = await paymentByIntent(pi.id)
      if (!payment) return 'no matching payment'
      await applyIntentState(payment, pi)
      return 'applied'
    }
    case 'charge.refunded':
    case 'charge.refund.updated': {
      const obj = event.data.object as Stripe.Charge | Stripe.Refund
      const chargeId = event.type === 'charge.refunded' ? (obj as Stripe.Charge).id : (typeof (obj as Stripe.Refund).charge === 'string' ? (obj as Stripe.Refund).charge as string : null)
      if (!chargeId) return 'no charge id'
      const { data } = await supabase.from('payments').select(PAYMENT_COLUMNS).eq('stripe_charge_id', chargeId).maybeSingle()
      const payment = data as PaymentRow | null
      if (!payment) return 'no matching payment'
      const charge = event.type === 'charge.refunded' ? (obj as Stripe.Charge) : await stripe.charges.retrieve(chargeId)
      const refunded = charge.amount_refunded ?? 0
      const status = refunded >= Number(payment.amount) ? 'refunded' : refunded > 0 ? 'partially_refunded' : payment.payment_status
      if (status !== payment.payment_status || refunded !== Number(payment.refund_amount ?? 0)) {
        await updatePayment(payment.id, { payment_status: status, refund_amount: refunded, refunded_at: refunded > 0 ? new Date().toISOString() : null })
        if (status !== payment.payment_status) await setBookingPaymentStatus(payment.booking_id, status)
      }
      return 'applied'
    }
    case 'transfer.created': {
      const transfer = event.data.object as Stripe.Transfer
      const paymentId = transfer.metadata?.payment_id
      if (!paymentId) return 'no payment_id metadata'
      await updatePayment(paymentId, { transfer_id: transfer.id, released_at: new Date(transfer.created * 1000).toISOString() })
      return 'applied'
    }
    case 'transfer.reversed': {
      const transfer = event.data.object as Stripe.Transfer
      const paymentId = transfer.metadata?.payment_id
      if (!paymentId) return 'no payment_id metadata'
      const payment = await paymentById(paymentId)
      await updatePayment(paymentId, { payment_metadata: { ...(payment as any)?.payment_metadata, reversed_amount: transfer.amount_reversed } })
      return 'applied'
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const complete = account.details_submitted && account.charges_enabled && account.payouts_enabled
      const restricted = !!account.requirements?.disabled_reason
        || (account.details_submitted && ((account.requirements?.currently_due?.length ?? 0) > 0 || (account.requirements?.past_due?.length ?? 0) > 0))
      const status = complete ? 'active' : restricted ? 'restricted' : 'pending'
      await supabase.from('provider_profiles').update({ stripe_account_status: status, bank_account_verified: !!account.payouts_enabled }).eq('stripe_account_id', account.id)
      return `account ${status}`
    }
    case 'account.application.deauthorized': {
      const appAccount = (event as any).account as string | undefined
      if (appAccount) await supabase.from('provider_profiles').update({ stripe_account_status: 'not_connected' }).eq('stripe_account_id', appAccount)
      return 'applied'
    }
    default:
      return 'ignored'
  }
}
