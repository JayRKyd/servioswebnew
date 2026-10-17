import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { HTTPException } from 'hono/http-exception'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import {
  PAYMENT_COLUMNS, loadPayableBooking, createOrReuseIntent, syncIntentStatus, paymentById,
  capturePayment, latestPaymentForBooking, constructWebhookEvent, claimStripeEvent,
  finishStripeEvent, applyStripeEvent, stripeConfigured,
} from '../lib/payments'

const payments = new Hono<{ Variables: { userId: string; user: any; activeRole: string } }>()

const createIntentSchema = z.object({ bookingId: z.string().uuid() })

async function assertPayer(bookingId: string, userId: string) {
  const loaded = await loadPayableBooking(bookingId)
  if (!loaded) throw new HTTPException(404, { message: 'Booking not found' })
  if (!loaded.payerUserIds.includes(userId)) throw new HTTPException(403, { message: 'Only the customer can pay for this booking' })
  return loaded.booking
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /intent — authorise the card (manual capture). Returns a client secret
// for the PaymentElement, or simulated:true when no Stripe key is configured.
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/intent', authMiddleware, zValidator('json', createIntentSchema), async (c) => {
  const { bookingId } = c.req.valid('json')
  const userId = c.get('userId')
  const booking = await assertPayer(bookingId, userId)

  if (!['accepted', 'in_progress'].includes(booking.status)) {
    throw new HTTPException(400, { message: 'Payment opens once the provider has accepted the booking' })
  }

  try {
    const result = await createOrReuseIntent(booking, userId)
    return c.json({ ...result, publishableKeyConfigured: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, stripeConfigured: stripeConfigured() })
  } catch (e: any) {
    console.error('create intent failed:', e)
    throw new HTTPException(400, { message: e?.message ?? 'Could not start the payment' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /sync/:paymentId — after the customer confirms on the client, pull the
// intent state so the page reflects it before the webhook lands
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/sync/:paymentId', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const payment = await paymentById(c.req.param('paymentId'))
  if (!payment) throw new HTTPException(404, { message: 'Payment not found' })
  await assertPayer(payment.booking_id, userId)
  const synced = await syncIntentStatus(payment)
  return c.json({ payment: synced })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /capture/:bookingId — capture the held funds. The escrow gate is the
// customer's confirmation: nothing is captured until customer_confirmed_at.
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/capture/:bookingId', authMiddleware, async (c) => {
  const bookingId = c.req.param('bookingId')
  const userId = c.get('userId')
  const booking = await assertPayer(bookingId, userId)
  if (!booking.customer_confirmed_at) {
    throw new HTTPException(400, { message: 'Confirm the job is complete before payment is released' })
  }
  try {
    const payment = await capturePayment(bookingId)
    return c.json({ payment })
  } catch (e: any) {
    console.error('capture failed:', e)
    throw new HTTPException(400, { message: e?.message ?? 'Could not release the payment' })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /booking/:bookingId — latest payment for a booking (payer or provider)
// ─────────────────────────────────────────────────────────────────────────────
payments.get('/booking/:bookingId', authMiddleware, async (c) => {
  const bookingId = c.req.param('bookingId')
  const userId = c.get('userId')
  const loaded = await loadPayableBooking(bookingId)
  if (!loaded) throw new HTTPException(404, { message: 'Booking not found' })
  let allowed = loaded.payerUserIds.includes(userId)
  if (!allowed && loaded.booking.provider_id) {
    const { data: pp } = await supabase.from('provider_profiles').select('user_id').eq('id', loaded.booking.provider_id).maybeSingle()
    allowed = pp?.user_id === userId
  }
  if (!allowed) throw new HTTPException(403, { message: 'Forbidden' })
  const payment = await latestPaymentForBooking(bookingId)
  return c.json({ payment })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhooks — Stripe → us. Signature-verified, idempotent by event id.
// Returns 500 on a handler error so Stripe retries.
// ─────────────────────────────────────────────────────────────────────────────
payments.post('/webhooks', async (c) => {
  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()
  if (!sig) throw new HTTPException(400, { message: 'Missing stripe-signature' })

  let event
  try {
    event = constructWebhookEvent(body, sig)
  } catch (e) {
    console.error('webhook signature failed:', e instanceof Error ? e.message : e)
    throw new HTTPException(400, { message: 'Webhook signature verification failed' })
  }

  const fresh = await claimStripeEvent(event)
  if (!fresh) return c.json({ received: true, duplicate: true })

  try {
    const outcome = await applyStripeEvent(event)
    await finishStripeEvent(event.id)
    return c.json({ received: true, outcome })
  } catch (e) {
    console.error(`webhook ${event.type} failed:`, e)
    await finishStripeEvent(event.id, e)
    // Let Stripe retry — but drop our claim first so the retry isn't a "duplicate"
    await supabase.from('stripe_events').delete().eq('id', event.id)
    throw new HTTPException(500, { message: 'Webhook handler failed' })
  }
})

export { payments as paymentRoutes }
export { PAYMENT_COLUMNS }
