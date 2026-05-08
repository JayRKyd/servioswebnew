import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware, requireActiveRole } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const invitations = new Hono()

invitations.use('*', authMiddleware)

const createInvitationSchema = z.object({
  providerEmail: z.string().email().optional(),
  providerId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  message: z.string().optional(),
  customCommissionRate: z.number().min(0).max(100).optional(),
})

// POST / — landlord invites provider
invitations.post('/', requireActiveRole('landlord'), zValidator('json', createInvitationSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  let providerId = body.providerId

  // Look up by email if no ID provided
  if (!providerId && body.providerEmail) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', body.providerEmail)
      .contains('roles', ['provider'])
      .single()

    if (!user) throw new HTTPException(404, { message: 'Provider not found with that email' })
    providerId = user.id
  }

  if (!providerId) throw new HTTPException(400, { message: 'Provider ID or email required' })

  // Check for existing active relationship
  const { data: existing } = await supabase
    .from('landlord_provider_relationships')
    .select('id, status')
    .eq('landlord_id', userId)
    .eq('provider_id', providerId)
    .single()

  if (existing?.status === 'active') {
    throw new HTTPException(400, { message: 'Provider is already in your preferred list' })
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      landlord_id: userId,
      provider_id: providerId,
      property_id: body.propertyId,
      message: body.message,
      custom_commission_rate: body.customCommissionRate,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ invitation: data }, 201)
})

// GET / — list invitations for current user
invitations.get('/', async (c) => {
  const userId = c.get('userId')
  const activeRole = c.get('activeRole')
  const status = c.req.query('status')

  let query = supabase
    .from('invitations')
    .select('*, landlord:landlord_profiles(*), provider:provider_profiles(*), property:properties(name)')
    .order('created_at', { ascending: false })

  if (activeRole === 'landlord') query = query.eq('landlord_id', userId)
  else if (activeRole === 'provider') query = query.eq('provider_id', userId)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ invitations: data })
})

// PUT /:id/accept — provider accepts
invitations.put('/:id/accept', requireActiveRole('provider'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: invitation } = await supabase
    .from('invitations')
    .select('provider_id, landlord_id, custom_commission_rate')
    .eq('id', id)
    .single()

  if (!invitation) throw new HTTPException(404, { message: 'Invitation not found' })
  if (invitation.provider_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { error: updateError } = await supabase
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) throw new HTTPException(400, { message: updateError.message })

  // Create the landlord-provider relationship
  await supabase.from('landlord_provider_relationships').upsert({
    landlord_id: invitation.landlord_id,
    provider_id: userId,
    relationship_type: 'invited',
    custom_commission_rate: invitation.custom_commission_rate || 10.0,
    is_active: true,
  })

  return c.json({ message: 'Invitation accepted' })
})

// PUT /:id/decline
invitations.put('/:id/decline', requireActiveRole('provider'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: invitation } = await supabase
    .from('invitations')
    .select('provider_id')
    .eq('id', id)
    .single()

  if (invitation?.provider_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { error } = await supabase
    .from('invitations')
    .update({ status: 'declined' })
    .eq('id', id)

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Invitation declined' })
})

// DELETE /:id — landlord cancels
invitations.delete('/:id', requireActiveRole('landlord'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: invitation } = await supabase
    .from('invitations')
    .select('landlord_id')
    .eq('id', id)
    .single()

  if (invitation?.landlord_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { error } = await supabase.from('invitations').delete().eq('id', id)
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Invitation cancelled' })
})

export { invitations as invitationRoutes }
