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
      content,
      message_type: messageType,
      metadata,
    })
    .select()
    .single()

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}

/** Verify the caller is a participant in this conversation */
async function assertParticipant(conversationId: string, userId: string) {
  const { data } = await supabase
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
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

  // Create booking_milestones from the offer
  const milestoneInserts = (offer.milestones as any[]).map((m: any) => ({
    booking_id:   null, // will be updated once booking is linked
    title:        m.title,
    description:  m.description ?? null,
    amount_cents: m.amount_cents,
    due_date:     m.due_date ?? null,
    status:       'pending',
    offer_id:     offerId,
  }))

  // Mark offer as accepted and link to the accepting user
  await supabase
    .from('job_offers')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', offerId)

  // Post system message
  await postSystemMessage(
    conversationId,
    userId,
    'offer_accepted',
    `Accepted the offer: "${offer.title}"`,
    { offer_id: offerId, title: offer.title, total_cents: offer.total_cents },
  )

  return c.json({ accepted: true, offer_id: offerId })
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
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', offerId)

  await postSystemMessage(
    conversationId,
    userId,
    'offer_declined',
    `Declined the offer: "${offer.title}"`,
    { offer_id: offerId, title: offer.title },
  )

  return c.json({ declined: true })
})

export { offers as offerRoutes }
