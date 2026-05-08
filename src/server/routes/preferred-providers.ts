import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const preferredProviders = new Hono()

preferredProviders.use('*', authMiddleware)

// GET /api/v1/preferred-providers
// Returns landlord's full preferred provider list with profile data
preferredProviders.get('/', async (c) => {
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('preferred_providers')
    .select(`
      id,
      notes,
      created_at,
      provider:provider_id (
        user_id,
        display_name,
        avatar_url,
        bio,
        categories,
        rating_average,
        rating_count,
        hourly_rate,
        island,
        is_verified,
        stripe_account_status
      )
    `)
    .eq('landlord_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new HTTPException(500, { message: error.message })

  return c.json({ preferred_providers: data ?? [] })
})

// POST /api/v1/preferred-providers
// Add a provider to the preferred list
preferredProviders.post(
  '/',
  zValidator('json', z.object({
    providerId: z.string().uuid(),
    notes: z.string().max(500).optional(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { providerId, notes } = c.req.valid('json')

    // Confirm provider exists
    const { data: providerProfile } = await supabase
      .from('provider_profiles')
      .select('user_id')
      .eq('user_id', providerId)
      .single()

    if (!providerProfile) throw new HTTPException(404, { message: 'Provider not found' })

    const { data, error } = await supabase
      .from('preferred_providers')
      .insert({
        landlord_id: userId,
        provider_id: providerId,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new HTTPException(409, { message: 'Provider already in preferred list' })
      }
      throw new HTTPException(500, { message: error.message })
    }

    return c.json({ preferred_provider: data }, 201)
  }
)

// PATCH /api/v1/preferred-providers/:providerId — update notes
preferredProviders.patch(
  '/:providerId',
  zValidator('json', z.object({
    notes: z.string().max(500).nullable(),
  })),
  async (c) => {
    const userId = c.get('userId')
    const { providerId } = c.req.param()
    const { notes } = c.req.valid('json')

    const { data, error } = await supabase
      .from('preferred_providers')
      .update({ notes })
      .eq('landlord_id', userId)
      .eq('provider_id', providerId)
      .select()
      .single()

    if (error || !data) throw new HTTPException(404, { message: 'Not found' })

    return c.json({ preferred_provider: data })
  }
)

// DELETE /api/v1/preferred-providers/:providerId
preferredProviders.delete('/:providerId', async (c) => {
  const userId = c.get('userId')
  const { providerId } = c.req.param()

  const { error } = await supabase
    .from('preferred_providers')
    .delete()
    .eq('landlord_id', userId)
    .eq('provider_id', providerId)

  if (error) throw new HTTPException(500, { message: error.message })

  return c.json({ success: true })
})

// GET /api/v1/preferred-providers/check/:providerId
// Quick check if a provider is in the landlord's list (used on provider cards)
preferredProviders.get('/check/:providerId', async (c) => {
  const userId = c.get('userId')
  const { providerId } = c.req.param()

  const { data } = await supabase
    .from('preferred_providers')
    .select('id')
    .eq('landlord_id', userId)
    .eq('provider_id', providerId)
    .maybeSingle()

  return c.json({ is_preferred: Boolean(data) })
})

export { preferredProviders as preferredProviderRoutes }
