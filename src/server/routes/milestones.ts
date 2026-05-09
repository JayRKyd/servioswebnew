import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { stripe } from '../lib/stripe'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const milestones = new Hono()

milestones.use('*', authMiddleware)

const createMilestoneSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amountCents: z.number().int().positive(),
  dueDate: z.string().optional(),
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/bookings/:bookingId/milestones
// ─────────────────────────────────────────────────────────────────────────────
milestones.get('/:bookingId/milestones', async (c) => {
  const bookingId = c.req.param('bookingId')
  const userId = c.get('userId')

  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, provider_id, landlord_id, payer_id')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })

  const allowed = [booking.customer_id, booking.provider_id, booking.landlord_id, booking.payer_id].filter(Boolean)
  if (!allowed.includes(userId)) throw new HTTPException(403, { message: 'Forbidden' })

  const { data, error } = await supabase
    .from('booking_milestones')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at')

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ milestones: data })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/bookings/:bookingId/milestones — create a milestone
// Only the payer (customer/landlord) can create milestones
// ─────────────────────────────────────────────────────────────────────────────
milestones.post('/:bookingId/milestones', zValidator('json', createMilestoneSchema), async (c) => {
  const bookingId = c.req.param('bookingId')
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data: booking } = await supabase
    .from('bookings')
    .select('payer_id, landlord_id, status')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })
  if (booking.payer_id !== userId && booking.landlord_id !== userId) {
    throw new HTTPException(403, { message: 'Only the payer can create milestones' })
  }
  if (!['accepted', 'in_progress'].includes(booking.status)) {
    throw new HTTPException(400, { message: 'Milestones can only be added to accepted or in-progress bookings' })
  }

  const { data, error } = await supabase
    .from('booking_milestones')
    .insert({
      booking_id: bookingId,
      title: body.title,
      description: body.description ?? null,
      amount_cents: body.amountCents,
      due_date: body.dueDate ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ milestone: data }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/bookings/:bookingId/milestones/:milestoneId/release
// Release a milestone: transfer funds to provider via Stripe Transfer
// ─────────────────────────────────────────────────────────────────────────────
milestones.post('/:bookingId/milestones/:milestoneId/release', async (c) => {
  const bookingId = c.req.param('bookingId')
  const milestoneId = c.req.param('milestoneId')
  const userId = c.get('userId')

  const { data: milestone } = await supabase
    .from('booking_milestones')
    .select('*')
    .eq('id', milestoneId)
    .eq('booking_id', bookingId)
    .single()

  if (!milestone) throw new HTTPException(404, { message: 'Milestone not found' })
  if (milestone.status !== 'pending') throw new HTTPException(400, { message: 'Milestone already released or failed' })

  const { data: booking } = await supabase
    .from('bookings')
    .select('payer_id, landlord_id, provider_id')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })
  if (booking.payer_id !== userId && booking.landlord_id !== userId) {
    throw new HTTPException(403, { message: 'Only the payer can release milestones' })
  }

  // Fetch provider's Connect account
  const { data: providerProfile } = await supabase
    .from('provider_profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', booking.provider_id)
    .single()

  if (!providerProfile?.stripe_account_id || providerProfile.stripe_account_status !== 'active') {
    throw new HTTPException(400, { message: 'Provider has not completed Stripe Connect onboarding' })
  }

  // Find the captured payment for this booking to use as source
  const { data: payment } = await supabase
    .from('payments')
    .select('stripe_charge_id, status')
    .eq('booking_id', bookingId)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!payment?.stripe_charge_id) {
    throw new HTTPException(400, { message: 'No captured payment found for this booking. Payment must be captured before releasing milestones.' })
  }

  // Create Stripe Transfer from platform to provider
  const transfer = await stripe.transfers.create({
    amount: milestone.amount_cents,
    currency: 'bsd',
    destination: providerProfile.stripe_account_id,
    source_transaction: payment.stripe_charge_id,
    metadata: { bookingId, milestoneId, milestoneTitle: milestone.title },
  })

  await supabase
    .from('booking_milestones')
    .update({
      status: 'released',
      stripe_transfer_id: transfer.id,
      released_at: new Date().toISOString(),
    })
    .eq('id', milestoneId)

  // Post a system message back to the booking's conversation (if one exists)
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('booking_id', bookingId)
    .single()

  if (conversation?.id) {
    const amountDollars = (milestone.amount_cents / 100).toFixed(2)
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id:       userId,
      content:         `Released payment for "${milestone.title}" — $${amountDollars}`,
      message_type:    'payment_released',
      metadata: {
        milestone_id:  milestoneId,
        booking_id:    bookingId,
        title:         milestone.title,
        amount_cents:  milestone.amount_cents,
        transfer_id:   transfer.id,
      },
    })
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
  }

  return c.json({ released: true, transferId: transfer.id })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/v1/bookings/:bookingId/milestones/:milestoneId
// ─────────────────────────────────────────────────────────────────────────────
milestones.delete('/:bookingId/milestones/:milestoneId', async (c) => {
  const bookingId = c.req.param('bookingId')
  const milestoneId = c.req.param('milestoneId')
  const userId = c.get('userId')

  const { data: milestone } = await supabase
    .from('booking_milestones')
    .select('status, booking_id')
    .eq('id', milestoneId)
    .single()

  if (!milestone || milestone.booking_id !== bookingId) throw new HTTPException(404, { message: 'Milestone not found' })
  if (milestone.status !== 'pending') throw new HTTPException(400, { message: 'Cannot delete a released milestone' })

  const { data: booking } = await supabase
    .from('bookings')
    .select('payer_id, landlord_id')
    .eq('id', bookingId)
    .single()

  if (booking?.payer_id !== userId && booking?.landlord_id !== userId) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  await supabase.from('booking_milestones').delete().eq('id', milestoneId)
  return c.json({ deleted: true })
})

export { milestones as milestoneRoutes }
