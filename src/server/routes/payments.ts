import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { stripe } from '../lib/stripe'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const payments = new Hono<{ Variables: { userId: string; user: any; activeRole: string } }>()

const createIntentSchema = z.object({
  bookingId: z.string().uuid(),
})

const refundSchema = z.object({
  reason: z.string().optional(),
  amount: z.number().positive().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /intent — create PaymentIntent (escrow / manual capture)
// Funds are authorised (held on card) but not transferred until capture.
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/intent', authMiddleware, zValidator('json', createIntentSchema), async (c) => {
  const { bookingId } = c.req.valid('json')
  const userId = c.get('userId')

  const { data: booking } = await supabase
    .from('bookings')
    .select('total_amount, platform_fee, payer_id, status, provider_id')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })
  if (booking.payer_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })
  if (booking.status !== 'accepted') throw new HTTPException(400, { message: 'Booking must be accepted before payment' })

  // total_amount stored in cents
  const amountCents = Math.round(booking.total_amount)

  // Check if Stripe is configured and provider has completed Connect onboarding
  const { data: providerProfile } = await supabase
    .from('provider_profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', booking.provider_id)
    .single()

  const stripeReady =
    process.env.STRIPE_SECRET_KEY &&
    providerProfile?.stripe_account_id &&
    providerProfile?.stripe_account_status === 'active'

  if (stripeReady) {
    // platform_fee is already stored in pence (minor units) — do not multiply by 100
    const applicationFeeCents = booking.platform_fee
      ? Math.round(booking.platform_fee)
      : Math.round(amountCents * 0.12)

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'gbp',
      capture_method: 'manual',
      transfer_data: { destination: providerProfile!.stripe_account_id },
      application_fee_amount: applicationFeeCents,
      metadata: { bookingId, userId, providerId: booking.provider_id },
    })

    await supabase.from('payments').insert({
      booking_id: bookingId,
      stripe_payment_intent_id: intent.id,
      amount: amountCents,
      currency: 'GBP',
      status: 'pending',
      payer_id: userId,
      capture_method: 'manual',
    })

    await supabase.from('bookings').update({ payment_status: 'authorized' }).eq('id', bookingId)

    return c.json({ clientSecret: intent.client_secret, simulated: false })
  }

  // ── Simulation mode: no Stripe keys / provider not on Stripe Connect ──
  const simId = `sim_${crypto.randomUUID()}`

  await supabase.from('payments').insert({
    booking_id: bookingId,
    stripe_payment_intent_id: simId,
    amount: amountCents,
    currency: 'GBP',
    status: 'authorized',
    payer_id: userId,
    capture_method: 'manual',
  })

  await supabase.from('bookings').update({ payment_status: 'authorized' }).eq('id', bookingId)

  return c.json({ clientSecret: null, simulated: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /capture/:paymentId — capture held funds (release from escrow)
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/capture/:paymentId', authMiddleware, async (c) => {
  const paymentId = c.req.param('paymentId')
  const userId = c.get('userId')

  const { data: payment } = await supabase
    .from('payments')
    .select('stripe_payment_intent_id, status, booking_id')
    .eq('id', paymentId)
    .single()

  if (!payment) throw new HTTPException(404, { message: 'Payment not found' })
  if (payment.status !== 'authorized') throw new HTTPException(400, { message: 'Payment not in authorized state' })

  const { data: booking } = await supabase
    .from('bookings')
    .select('payer_id, landlord_id')
    .eq('id', payment.booking_id)
    .single()

  if (booking?.payer_id !== userId && booking?.landlord_id !== userId) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  // Skip real Stripe capture for simulated payments
  const isSimulated = payment.stripe_payment_intent_id?.startsWith('sim_')

  if (!isSimulated) {
    const captured = await stripe.paymentIntents.capture(payment.stripe_payment_intent_id)
    await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        captured_at: new Date().toISOString(),
        stripe_charge_id: (captured.latest_charge as string) ?? null,
      })
      .eq('id', paymentId)
  } else {
    await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        captured_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
  }

  await supabase
    .from('bookings')
    .update({ payment_status: 'paid' })
    .eq('id', payment.booking_id)

  return c.json({ captured: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks — Stripe webhook (no auth — verified by signature)
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/webhooks', async (c) => {
  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    throw new HTTPException(400, { message: 'Webhook signature verification failed' })
  }

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      const intent = event.data.object as any
      await supabase
        .from('payments')
        .update({ status: 'authorized' })
        .eq('stripe_payment_intent_id', intent.id)
      await supabase
        .from('bookings')
        .update({ payment_status: 'authorized' })
        .eq('id', intent.metadata?.bookingId)
      break
    }

    case 'payment_intent.succeeded': {
      const intent = event.data.object as any
      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          captured_at: new Date().toISOString(),
          stripe_charge_id: intent.latest_charge ?? null,
        })
        .eq('stripe_payment_intent_id', intent.id)
      await supabase
        .from('bookings')
        .update({ payment_status: 'paid' })
        .eq('id', intent.metadata?.bookingId)
      break
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object as any
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', intent.id)
      break
    }

    case 'payment_intent.canceled': {
      const intent = event.data.object as any
      await supabase
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('stripe_payment_intent_id', intent.id)
      await supabase
        .from('bookings')
        .update({ payment_status: 'unpaid' })
        .eq('id', intent.metadata?.bookingId)
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as any
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('stripe_charge_id', charge.id)
      break
    }

    // Connect account status changed (provider completed or updated onboarding)
    case 'account.updated': {
      const account = event.data.object as any
      const status =
        account.details_submitted && account.charges_enabled && account.payouts_enabled
          ? 'active'
          : 'pending'
      await supabase
        .from('provider_profiles')
        .update({ stripe_account_status: status })
        .eq('stripe_account_id', account.id)
      break
    }

    case 'transfer.created': {
      const transfer = event.data.object as any
      if (transfer.source_transaction) {
        await supabase
          .from('payments')
          .update({ transfer_id: transfer.id })
          .eq('stripe_charge_id', transfer.source_transaction)
      }
      break
    }
  }

  return c.json({ received: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /booking/:bookingId
// ─────────────────────────────────────────────────────────────────────────────
payments.get('/booking/:bookingId', authMiddleware, async (c) => {
  const bookingId = c.req.param('bookingId')
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) throw new HTTPException(404, { message: 'Payment not found' })
  return c.json({ payment: data })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /refund/:paymentId
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/refund/:paymentId', authMiddleware, zValidator('json', refundSchema), async (c) => {
  const paymentId = c.req.param('paymentId')
  const { reason, amount } = c.req.valid('json')

  const { data: payment } = await supabase
    .from('payments')
    .select('stripe_payment_intent_id, amount, status')
    .eq('id', paymentId)
    .single()

  if (!payment) throw new HTTPException(404, { message: 'Payment not found' })

  // Cancel the hold if not yet captured
  if (payment.status === 'authorized') {
    await stripe.paymentIntents.cancel(payment.stripe_payment_intent_id)
    await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId)
    return c.json({ cancelled: true })
  }

  const refund = await stripe.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: amount ? Math.round(amount * 100) : undefined,
    reason: (reason as any) || 'requested_by_customer',
  })

  await supabase
    .from('payments')
    .update({ status: 'refunded', refund_id: refund.id })
    .eq('id', paymentId)

  return c.json({ refund })
})

export { payments as paymentRoutes }
