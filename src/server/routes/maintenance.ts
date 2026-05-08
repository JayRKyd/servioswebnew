import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'
import { sendPush } from '../lib/notifications'

const maintenance = new Hono()

maintenance.use('*', authMiddleware)

const createRequestSchema = z.object({
  propertyId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  category: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  estimatedCost: z.number().positive().optional(), // pence/cents
})

const approveRequestSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  scheduledDate: z.string(),
  scheduledTimeStart: z.string(),
  notes: z.string().optional(),
})

// GET / — role-filtered
maintenance.get('/', async (c) => {
  const userId = c.get('userId')
  const activeRole = c.get('activeRole')
  const status = c.req.query('status')
  const propertyId = c.req.query('propertyId')

  let query = supabase
    .from('maintenance_requests')
    .select('*, property:properties(name, address), tenant:tenant_profiles(first_name, last_name), booking:bookings(*)')
    .order('created_at', { ascending: false })

  if (activeRole === 'tenant') query = query.eq('tenant_id', userId)
  else if (activeRole === 'landlord') query = query.eq('landlord_id', userId)
  if (status) query = query.eq('status', status)
  if (propertyId) query = query.eq('property_id', propertyId)

  const { data, error } = await query
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ requests: data })
})

// GET /:id
maintenance.get('/:id', async (c) => {
  const id = c.req.param('id')
  const { data, error } = await supabase
    .from('maintenance_requests')
    .select('*, property:properties(*), tenant:tenant_profiles(*), booking:bookings(*)')
    .eq('id', id)
    .single()

  if (error) throw new HTTPException(404, { message: 'Maintenance request not found' })
  return c.json({ request: data })
})

// POST /
maintenance.post('/', zValidator('json', createRequestSchema), async (c) => {
  const userId = c.get('userId')
  const activeRole = c.get('activeRole')
  const body = c.req.valid('json')

  const { data: property } = await supabase
    .from('properties')
    .select('landlord_id')
    .eq('id', body.propertyId)
    .single()

  if (!property) throw new HTTPException(404, { message: 'Property not found' })

  const landlordId: string = property.landlord_id
  const isEmergency = body.priority === 'emergency'

  // Check auto-approval threshold (non-emergency only)
  let autoApproved = false
  if (!isEmergency && body.estimatedCost !== undefined) {
    const { data: landlordProfile } = await supabase
      .from('landlord_profiles')
      .select('auto_approve_threshold')
      .eq('user_id', landlordId)
      .single()

    const threshold: number | null = landlordProfile?.auto_approve_threshold ?? null
    if (threshold !== null && body.estimatedCost <= threshold) {
      autoApproved = true
    }
  }

  const status = autoApproved ? 'approved' : 'pending'

  const { data, error } = await supabase
    .from('maintenance_requests')
    .insert({
      property_id: body.propertyId,
      landlord_id: landlordId,
      tenant_id: activeRole === 'tenant' ? userId : null,
      reported_by: userId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      category: body.category,
      photos: body.photos || [],
      status,
      ...(autoApproved ? { approved_at: new Date().toISOString() } : {}),
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  // Notify landlord
  if (isEmergency) {
    // Urgent push — don't await so response isn't delayed
    sendPush(
      landlordId,
      '🚨 Emergency at Your Property',
      `${body.title} — immediate attention required.`,
      { maintenanceId: data.id, screen: 'maintenance', priority: 'emergency' }
    ).catch(console.error)
  } else if (autoApproved) {
    sendPush(
      landlordId,
      'Repair Auto-Approved',
      `"${body.title}" was auto-approved (under threshold). A provider will be assigned.`,
      { maintenanceId: data.id, screen: 'maintenance' }
    ).catch(console.error)
  } else {
    sendPush(
      landlordId,
      'New Repair Request',
      `"${body.title}" needs your approval.`,
      { maintenanceId: data.id, screen: 'maintenance' }
    ).catch(console.error)
  }

  return c.json({ request: data, autoApproved }, 201)
})

// PUT /:id/approve — landlord approves and assigns provider
maintenance.put('/:id/approve', zValidator('json', approveRequestSchema), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('landlord_id')
    .eq('id', id)
    .single()

  if (!request) throw new HTTPException(404, { message: 'Request not found' })
  if (request.landlord_id !== userId) throw new HTTPException(403, { message: 'Only the landlord can approve requests' })

  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ request: data })
})

// PUT /:id/status
maintenance.put('/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()

  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ request: data })
})

// DELETE /:id
maintenance.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('reported_by, landlord_id')
    .eq('id', id)
    .single()

  if (!request || (request.reported_by !== userId && request.landlord_id !== userId)) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const { error } = await supabase.from('maintenance_requests').delete().eq('id', id)
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Request deleted' })
})

export { maintenance as maintenanceRoutes }
