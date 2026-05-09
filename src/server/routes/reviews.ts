import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const reviews = new Hono()

reviews.use('*', authMiddleware)

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  providerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

// GET /provider/:providerId
reviews.get('/provider/:providerId', async (c) => {
  const providerId = c.req.param('providerId')

  const { data, error } = await supabase
    .from('reviews')
    .select('*, reviewer:users(customer_profiles(first_name, last_name))')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ reviews: data })
})

// POST /
reviews.post('/', zValidator('json', createReviewSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  // Verify booking is completed and reviewer is the customer/landlord
  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, landlord_id, payer_id, status')
    .eq('id', body.bookingId)
    .single()

  if (!booking) throw new HTTPException(404, { message: 'Booking not found' })
  if (booking.status !== 'completed') throw new HTTPException(400, { message: 'Can only review completed bookings' })
  if (![booking.customer_id, booking.landlord_id].includes(userId)) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  // Check for duplicate review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', body.bookingId)
    .eq('reviewer_id', userId)
    .single()

  if (existing) throw new HTTPException(400, { message: 'Already reviewed this booking' })

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      booking_id: body.bookingId,
      provider_id: body.providerId,
      reviewer_id: userId,
      rating: body.rating,
      comment: body.comment,
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  // Update provider's average rating
  const { data: avgData } = await supabase
    .from('reviews')
    .select('rating')
    .eq('provider_id', body.providerId)

  if (avgData) {
    const avg = avgData.reduce((sum, r) => sum + r.rating, 0) / avgData.length
    await supabase
      .from('provider_profiles')
      .update({ rating_average: Math.round(avg * 10) / 10, rating_count: avgData.length })
      .eq('user_id', body.providerId)
  }

  return c.json({ review: data }, 201)
})

// PUT /:id
reviews.put('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const body = await c.req.json()

  const { data: review } = await supabase.from('reviews').select('reviewer_id').eq('id', id).single()
  if (review?.reviewer_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { data, error } = await supabase.from('reviews').update(body).eq('id', id).select().single()
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ review: data })
})

// DELETE /:id
reviews.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: review } = await supabase.from('reviews').select('reviewer_id').eq('id', id).single()
  if (review?.reviewer_id !== userId) throw new HTTPException(403, { message: 'Forbidden' })

  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Review deleted' })
})

export { reviews as reviewRoutes }
