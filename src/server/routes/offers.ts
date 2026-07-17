import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const offers = new Hono()

offers.use('*', authMiddleware)

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Insert a system message into a conversation */
async function postSystemMessage(
  conversationId: string,
  senderId: string,
  messageType: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  const { data } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_text: content,
      message_type: messageType,
      metadata,
    })
    .select()
    .single()

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

/** Verify the caller is a participant in this conversation */
async function assertParticipant(conversationId: string, userId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .or(`customer_id.eq.${userId},provider_id.eq.${userId},landlord_id.eq.${userId},tenant_id.eq.${userId}`)
    .single()
  if (!data) throw new HTTPException(403, { message: 'Forbidden' })
}

// ─── schemas ──────────────────────────────────────────────────────────────────

const milestoneSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  amount_cents: z.number().int().positive(),
  due_date:    z.string().optional(),
})

const createOfferSchema = z.object({
  title:       z.string().min(1),
  description: z.string().optional(),
  milestones:  z.array(milestoneSchema).min(1),
})

// ─── GET /api/v1/conversations/:conversationId/offers (latest offer) ─────────

offers.get('/:conversationId/offers', async (c) => {
  const conversationId = c.req.param('conversationId')
  const userId         = c.get('userId')

  await assertParticipant(conversationId, userId)

  const { data } = await supabase
    .from('job_offers')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return c.json({ offer: data ?? null })
})

// ─── GET /api/v1/conversations/:conversationId/offers/:offerId ────────────────

offers.get('/:conversationId/offers/:offerId', async (c) => {
  const conversationId = c.req.param('conversationId')
  const offerId        = c.req.param('offerId')
  const userId         = c.get('userId')

  await assertParticipant(conversationId, userId)

  const { data, error } = await supabase
    .from('job_offers')
    .select('*')
    .eq('id', offerId)
    .eq('conversation_id', conversationId)
    .single()

  if (error || !data) throw new HTTPException(404, { message: 'Offer not found' })
  return c.json({ offer: data })
})

// ─── POST /api/v1/conversations/:conversationId/offers ───────────────────────

offers.post(
  '/:conversationId/offers',
  zValidator('json', createOfferSchema),
  async (c) => {
    const conversationId = c.req.param('conversationId')
    const userId         = c.get('userId')
    const body           = c.req.valid('json')

    await assertParticipant(conversationId, userId)

    const totalCents = body.milestones.reduce((sum, m) => sum + m.amount_cents, 0)

    const { data: offer, error } = await supabase
      .from('job_offers')
      .insert({
        conversation_id: conversationId,
        proposed_by:     userId,
        title:           body.title,
        description:     body.description ?? null,
        total_cents:     totalCents,
        milestones:      body.milestones,
        status:          'sent',
        version:         1,
      })
      .select()
      .single()

    if (error) throw new HTTPException(400, { message: error.message })

    await postSystemMessage(
      conversationId,
      userId,
      'offer_sent',
      `Sent an offer: "${body.title}"`,
      { offer_id: offer.id, title: body.title, total_cents: totalCents },
    )

    return c.json({ offer }, 201)
  },
)

// ─── PUT /api/v1/conversations/:conversationId/offers/:offerId ───────────────

offers.put(
  '/:conversationId/offers/:offerId',
  zValidator('json', createOfferSchema),
  async (c) => {
    const conversationId = c.req.param('conversationId')
    const offerId        = c.req.param('offerId')
    const userId         = c.get('userId')
    const body           = c.req.valid('json')

    const { data: existing } = await supabase
      .from('job_offers')
      .select('proposed_by, version, status')
      .eq('id', offerId)
      .single()

    if (!existing) throw new HTTPException(404, { message: 'Offer not found' })
    if (existing.proposed_by !== userId) throw new HTTPException(403, { message: 'Only the proposer can edit this offer' })
    if (existing.status === 'accepted') throw new HTTPException(400, { message: 'Cannot edit an accepted offer' })

    const totalCents = body.milestones.reduce((sum, m) => sum + m.amount_cents, 0)
    const newVersion = (existing.version ?? 1) + 1

    const { data: offer, error } = await supabase
      .from('job_offers')
      .update({
        title:       body.title,
        description: body.description ?? null,
        total_cents: totalCents,
        milestones:  body.milestones,
        status:      'sent',
        version:     newVersion,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', offerId)
      .select()
      .single()

    if (error) throw new HTTPException(400, { message: error.message })

    await postSystemMessage(
      conversationId,
      userId,
      'offer_updated',
      `Updated the offer: "${body.title}"`,
      { offer_id: offerId, title: body.title, total_cents: totalCents, version: newVersion },
    )

    return c.json({ offer })
  },
)

// ─── POST /api/v1/conversations/:conversationId/offers/:offerId/accept ────────
//
// Accepting an offer forms the contract: the conversation's booking is
// created (or updated) with the agreed financials, and the offer's proposed
// milestones become real booking_milestones.

const COMMISSION_RATE = 0.12

offers.post('/:conversationId/offers/:offerId/accept', async (c) => {
  const conversationId = c.req.param('conversationId')
  const offerId        = c.req.param('offerId')
  const userId         = c.get('userId')

  await assertParticipant(conversationId, userId)

  const { data: offer } = await supabase
    .from('job_offers')
    .select('*')
    .eq('id', offerId)
    .eq('conversation_id', conversationId)
    .single()

  if (!offer) throw new HTTPException(404, { message: 'Offer not found' })
  if (offer.proposed_by === userId) throw new HTTPException(400, { message: 'You cannot accept your own offer' })
  if (offer.status !== 'sent') throw new HTTPException(400, { message: `Offer is already ${offer.status}` })

  const { data: conv } = await supabase
    .from('conversations')
    .select('id, booking_id, customer_id, provider_id')
    .eq('id', conversationId)
    .single()
  if (!conv) throw new HTTPException(404, { message: 'Conversation not found' })

  const totalCents  = offer.total_cents ?? 0
  const platformFee = Math.round(totalCents * COMMISSION_RATE)

  // ── Resolve or create the booking ──
  let bookingId: string | null = conv.booking_id

  if (bookingId) {
    // Existing booking: apply the agreed contract financials; move a pending
    // request to accepted (never downgrade an in-progress/completed job)
    await supabase.from('bookings').update({
      base_amount:     totalCents,
      platform_fee:    platformFee,
      total_amount:    totalCents + platformFee,
      commission_rate: COMMISSION_RATE,
    }).eq('id', bookingId)
    await supabase.from('bookings').update({ status: 'accepted' })
      .eq('id', bookingId).eq('status', 'pending')
  } else {
    // No booking yet (conversation started from the provider's profile) —
    // acceptance is the moment the contract, and therefore the booking, exists
    const [{ data: cp }, { data: pp }] = await Promise.all([
      supabase.from('customer_profiles').select('id').eq('user_id', conv.customer_id).maybeSingle(),
      supabase.from('provider_profiles').select('id').eq('user_id', conv.provider_id).maybeSingle(),
    ])
    if (!cp || !pp) throw new HTTPException(400, { message: 'Conversation participants are missing profiles' })

    // bookings.service_id is required — use the provider's primary service
    const { data: ps } = await supabase
      .from('provider_services')
      .select('service_id')
      .eq('provider_id', pp.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    let serviceId: string | undefined = ps?.service_id
    if (!serviceId) {
      const { data: anySvc } = await supabase
        .from('services').select('id').eq('is_active', true).limit(1).maybeSingle()
      serviceId = anySvc?.id
    }
    if (!serviceId) throw new HTTPException(400, { message: 'No service available to attach the contract to' })

    const milestones = (offer.milestones as any[]) ?? []
    const firstDue = milestones.find((m) => m.due_date)?.due_date
    const scheduledDate = firstDue
      ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
      customer_id:          cp.id,
      provider_id:          pp.id,
      service_id:           serviceId,
      scheduled_date:       scheduledDate,
      scheduled_time_start: '09:00',
      status:               'accepted',
      booking_type:         'direct_customer',
      base_amount:          totalCents,
      platform_fee:         platformFee,
      total_amount:         totalCents + platformFee,
      commission_rate:      COMMISSION_RATE,
      customer_notes:       `Contract: ${offer.title}`,
    }).select('id').single()

    if (bookingError || !booking) {
      throw new HTTPException(400, { message: bookingError?.message ?? 'Failed to create booking' })
    }
    bookingId = booking.id
    await supabase.from('conversations').update({ booking_id: bookingId }).eq('id', conversationId)
  }

  // ── Materialise the offer's milestones ──
  const { data: maxRow } = await supabase
    .from('booking_milestones')
    .select('milestone_number')
    .eq('booking_id', bookingId)
    .order('milestone_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const startNumber = (maxRow?.milestone_number ?? 0) + 1

  const milestoneInserts = ((offer.milestones as any[]) ?? []).map((m: any, i: number) => {
    const amount     = m.amount_cents / 100
    const commission = Math.round(m.amount_cents * COMMISSION_RATE) / 100
    return {
      booking_id:          bookingId,
      milestone_number:    startNumber + i,
      title:               m.title,
      description:         m.description ?? null,
      amount,
      platform_commission: commission,
      provider_amount:     amount - commission,
      commission_rate:     COMMISSION_RATE * 100,
      currency:            'GBP',
      status:              'pending',
      due_date:            m.due_date ?? null,
    }
  })

  if (milestoneInserts.length > 0) {
    const { error: milestoneError } = await supabase.from('booking_milestones').insert(milestoneInserts)
    if (milestoneError) throw new HTTPException(400, { message: milestoneError.message })
  }

  // ── Mark the offer accepted and link it to the booking ──
  await supabase
    .from('job_offers')
    .update({
      status:      'accepted',
      accepted_at: new Date().toISOString(),
      booking_id:  bookingId,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', offerId)

  await postSystemMessage(
    conversationId,
    userId,
    'offer_accepted',
    `Accepted the offer: "${offer.title}"`,
    { offer_id: offerId, title: offer.title, total_cents: offer.total_cents, booking_id: bookingId },
  )

  // Tell the proposer their offer was accepted
  await supabase.from('notifications').insert({
    user_id: offer.proposed_by,
    notification_type: 'offer_accepted',
    title: 'Offer accepted',
    body: `Your offer "${offer.title}" was accepted. The contract and milestones are now live.`,
    data: { conversation_id: conversationId, booking_id: bookingId },
  })

  return c.json({ accepted: true, offer_id: offerId, booking_id: bookingId })
})

// ─── POST /api/v1/conversations/:conversationId/offers/:offerId/decline ───────

offers.post('/:conversationId/offers/:offerId/decline', async (c) => {
  const conversationId = c.req.param('conversationId')
  const offerId        = c.req.param('offerId')
  const userId         = c.get('userId')

  await assertParticipant(conversationId, userId)

  const { data: offer } = await supabase
    .from('job_offers')
    .select('proposed_by, status, title')
    .eq('id', offerId)
    .single()

  if (!offer) throw new HTTPException(404, { message: 'Offer not found' })
  if (offer.proposed_by === userId) throw new HTTPException(400, { message: 'You cannot decline your own offer' })
  if (offer.status !== 'sent') throw new HTTPException(400, { message: `Offer is already ${offer.status}` })

  await supabase
    .from('job_offers')
    .update({ status: 'declined', declined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', offerId)

  await postSystemMessage(
    conversationId,
    userId,
    'offer_declined',
    `Declined the offer: "${offer.title}"`,
    { offer_id: offerId, title: offer.title },
  )

  // Tell the proposer, so they can follow up or revise
  await supabase.from('notifications').insert({
    user_id: offer.proposed_by,
    notification_type: 'offer_declined',
    title: 'Offer declined',
    body: `Your offer "${offer.title}" was declined. You can send a revised offer from the conversation.`,
    data: { conversation_id: conversationId },
  })

  return c.json({ declined: true })
})

export { offers as offerRoutes }
