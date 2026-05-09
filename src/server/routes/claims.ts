import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const claims = new Hono()
claims.use('*', authMiddleware)

const CLAIM_WINDOW_DAYS = 90

const createClaimSchema = z.object({
  bookingId: z.string().uuid(),
  description: z.string().min(10),
  evidenceUrls: z.array(z.string()).optional(),
})

// POST /api/v1/claims — file a new workmanship claim
claims.post('/', zValidator('json', createClaimSchema), async (c) => {
  const userId = c.get('userId')
  const { bookingId, description, evidenceUrls } = c.req.valid('json')

  // Check booking exists, is completed, and caller is the customer/payer
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, completed_at, customer_id, payer_id')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })
  if (booking.status !== 'completed') throw new HTTPException(400, { message: 'Can only claim on completed bookings' })
  if (booking.customer_id !== userId && booking.payer_id !== userId) {
    throw new HTTPException(403, { message: 'Only the customer can file a claim' })
  }

  // Enforce 90-day window
  if (booking.completed_at) {
    const completedAt = new Date(booking.completed_at)
    const daysSince = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > CLAIM_WINDOW_DAYS) {
      throw new HTTPException(400, { message: `Claims must be filed within ${CLAIM_WINDOW_DAYS} days of completion` })
    }
  }

  const { data, error } = await supabase
    .from('workmanship_claims')
    .insert({
      booking_id: bookingId,
      claimant_id: userId,
      description,
      evidence_urls: evidenceUrls ?? [],
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new HTTPException(409, { message: 'A claim already exists for this booking' })
    throw new HTTPException(400, { message: error.message })
  }

  return c.json({ claim: data }, 201)
})

// GET /api/v1/claims — list claims for current user
claims.get('/', async (c) => {
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('workmanship_claims')
    .select('*, booking:bookings(booking_number, scheduled_date, service:services(title), provider:provider_profiles(first_name, last_name, business_name))')
    .eq('claimant_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ claims: data })
})

// GET /api/v1/claims/admin — admin: all claims
claims.get('/admin', async (c) => {
  const userId = c.get('userId')
  // Only admins (checked via metadata)
  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (!profile) throw new HTTPException(403, { message: 'Admin only' })

  const { data, error } = await supabase
    .from('workmanship_claims')
    .select('*, booking:bookings(booking_number, scheduled_date, total_amount, service:services(title), provider:provider_profiles(first_name, last_name, business_name)), claimant:customer_profiles!claimant_id(first_name, last_name, email)')
    .order('created_at', { ascending: false })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ claims: data })
})

// PATCH /api/v1/claims/:id — admin resolves/rejects a claim
claims.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const { status, resolution_notes } = await c.req.json<{ status: string; resolution_notes?: string }>()

  const { data: profile } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (!profile) throw new HTTPException(403, { message: 'Admin only' })

  const { data, error } = await supabase
    .from('workmanship_claims')
    .update({ status, resolution_notes: resolution_notes ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ claim: data })
})

export { claims as claimRoutes }
