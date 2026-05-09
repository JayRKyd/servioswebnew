import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const bookings = new Hono()

bookings.use('*', authMiddleware)

const createBookingSchema = z.object({
  serviceId: z.string().uuid(),
  providerId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  landlordId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  maintenanceRequestId: z.string().uuid().optional(),
  scheduledDate: z.string(),
  scheduledTimeStart: z.string(),
  scheduledTimeEnd: z.string().optional(),
  baseAmount: z.number().positive(),
  travelFee: z.number().optional(),
  serviceAddress: z.object({
    street: z.string(),
    city: z.string(),
    island: z.string(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }),
  customerNotes: z.string().optional(),
  isEmergency: z.boolean().optional(),
})

// GET /api/v1/bookings
bookings.get('/', async (c) => {
  const userId = c.get('userId')
  const activeRole = c.get('activeRole')
  const status = c.req.query('status')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const propertyId = c.req.query('propertyId')

  let query = supabase
    .from('bookings')
    .select('*, customer:customer_profiles(*), provider:provider_profiles(*), service:services(*), property:properties(*), landlord:landlord_profiles(*), tenant:tenant_profiles(*), milestones:booking_milestones(*)')

  if (activeRole === 'customer') query = query.eq('customer_id', userId)
  else if (activeRole === 'provider') query = query.eq('provider_id', userId)
  else if (activeRole === 'landlord') query = query.eq('landlord_id', userId)
  else if (activeRole === 'tenant') query = query.eq('tenant_id', userId)

  if (status) query = query.eq('status', status)
  if (startDate) query = query.gte('scheduled_date', startDate)
  if (endDate) query = query.lte('scheduled_date', endDate)
  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw new HTTPException(400, { message: error.message })

  return c.json({ bookings: data })
})

// GET /api/v1/bookings/:id
bookings.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('bookings')
    .select('*, customer:customer_profiles(*), provider:provider_profiles(*), service:services(*), property:properties(*), landlord:landlord_profiles(*), tenant:tenant_profiles(*), milestones:booking_milestones(*), maintenance_request:maintenance_requests(*)')
    .eq('id', id)
    .single()

  if (error) throw new HTTPException(404, { message: 'Booking not found' })

  const allowedUsers = [data.customer_id, data.provider_id, data.landlord_id, data.tenant_id, data.payer_id].filter(Boolean)
  if (!allowedUsers.includes(userId)) throw new HTTPException(403, { message: 'Forbidden' })

  return c.json({ booking: data })
})

// POST /api/v1/bookings
bookings.post('/', zValidator('json', createBookingSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const commissionRate = await calculateCommissionRate(body.landlordId, body.providerId, body.isEmergency || false)
  const platformFee = (body.baseAmount * commissionRate) / 100
  const totalAmount = body.baseAmount + (body.travelFee || 0) + platformFee
  const bookingNumber = `SRV-${new Date().getFullYear()}-${Date.now()}`

  let bookingType = 'direct_customer'
  if (body.landlordId && !body.maintenanceRequestId) bookingType = 'landlord_direct'
  else if (body.maintenanceRequestId) bookingType = 'tenant_request'

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_number: bookingNumber,
      customer_id: body.customerId || userId,
      provider_id: body.providerId,
      service_id: body.serviceId,
      landlord_id: body.landlordId,
      property_id: body.propertyId,
      tenant_id: body.tenantId,
      maintenance_request_id: body.maintenanceRequestId,
      scheduled_date: body.scheduledDate,
      scheduled_time_start: body.scheduledTimeStart,
      scheduled_time_end: body.scheduledTimeEnd,
      service_address: body.serviceAddress,
      base_amount: body.baseAmount,
      travel_fee: body.travelFee || 0,
      platform_fee: platformFee,
      total_amount: totalAmount,
      commission_rate: commissionRate,
      booking_type: bookingType,
      payer_type: body.landlordId ? 'landlord' : 'customer',
      payer_id: body.landlordId || userId,
      customer_notes: body.customerNotes,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  return c.json({ booking: data }, 201)
})

// PUT /api/v1/bookings/:id/accept
bookings.put('/:id/accept', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: booking } = await supabase.from('bookings').select('provider_id, status').eq('id', id).single()
  if (booking?.provider_id !== userId) throw new HTTPException(403, { message: 'Only the provider can accept this booking' })
  if (booking.status !== 'pending') throw new HTTPException(400, { message: 'Booking cannot be accepted in current status' })

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ booking: data })
})

// PUT /api/v1/bookings/:id/reject
bookings.put('/:id/reject', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const { reason } = await c.req.json()

  const { data: booking } = await supabase.from('bookings').select('provider_id').eq('id', id).single()
  if (booking?.provider_id !== userId) throw new HTTPException(403, { message: 'Only the provider can reject this booking' })

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'rejected', cancellation_reason: reason, cancelled_by: userId, cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ booking: data })
})

// PUT /api/v1/bookings/:id/customer-confirm — customer confirms job is done
bookings.put('/:id/customer-confirm', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, landlord_id, status')
    .eq('id', id)
    .single()

  const isAllowed = booking?.customer_id === userId || booking?.landlord_id === userId
  if (!isAllowed) throw new HTTPException(403, { message: 'Only the customer can confirm completion' })
  if (!['in_progress', 'accepted'].includes(booking?.status ?? '')) {
    throw new HTTPException(400, { message: 'Booking cannot be confirmed in current status' })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ booking: data })
})

// PUT /api/v1/bookings/:id/complete
bookings.put('/:id/complete', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: booking } = await supabase.from('bookings').select('provider_id').eq('id', id).single()
  if (booking?.provider_id !== userId) throw new HTTPException(403, { message: 'Only the provider can mark as complete' })

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ booking: data })
})

// PUT /api/v1/bookings/:id/cancel
bookings.put('/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const { reason } = await c.req.json()

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: reason, cancelled_by: userId, cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ booking: data })
})

// DELETE /api/v1/bookings/:id
bookings.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: existing } = await supabase.from('bookings').select('customer_id, landlord_id').eq('id', id).single()
  if (!existing || (existing.customer_id !== userId && existing.landlord_id !== userId)) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw new HTTPException(400, { message: error.message })

  return c.json({ message: 'Booking deleted successfully' })
})

async function getBaseRates(): Promise<{ standard: number; preferred: number; emergency: number }> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'commission_rates')
    .single()
  return (data?.value as any) ?? { standard: 12, preferred: 10, emergency: 15 }
}

async function calculateCommissionRate(landlordId: string | undefined, providerId: string, isEmergency: boolean): Promise<number> {
  const rates = await getBaseRates()

  if (isEmergency) return rates.emergency

  if (landlordId) {
    const { data } = await supabase
      .from('landlord_provider_relationships')
      .select('custom_commission_rate')
      .eq('landlord_id', landlordId)
      .eq('provider_id', providerId)
      .eq('relationship_type', 'invited')
      .eq('is_active', true)
      .maybeSingle()

    if (data) return data.custom_commission_rate ?? rates.preferred
  }

  return rates.standard
}

export { bookings as bookingRoutes }
