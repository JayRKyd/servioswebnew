import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware, requireActiveRole } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const services = new Hono()

const createServiceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  basePrice: z.number().positive().optional(),
  priceType: z.enum(['fixed', 'hourly', 'quote']).default('hourly'),
  duration: z.number().positive().optional(),
})

// GET / — public, list all service categories
services.get('/', async (c) => {
  const category = c.req.query('category')
  const providerId = c.req.query('providerId')

  let query = supabase.from('services').select('*').order('category').order('title')
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ services: data })
})

// GET /:id
services.get('/:id', async (c) => {
  const id = c.req.param('id')
  const { data, error } = await supabase
    .from('services')
    .select('*, providers:provider_services(provider:provider_profiles(*))')
    .eq('id', id)
    .single()

  if (error) throw new HTTPException(404, { message: 'Service not found' })
  return c.json({ service: data })
})

// POST / — provider creates service offering
services.post('/', authMiddleware, requireActiveRole('provider'), zValidator('json', createServiceSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  // Upsert the service type
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .upsert({ title: body.title, description: body.description, category: body.category }, { onConflict: 'title' })
    .select()
    .single()

  if (serviceError) throw new HTTPException(400, { message: serviceError.message })

  // Link provider to service
  const { data, error } = await supabase
    .from('provider_services')
    .insert({
      provider_id: userId,
      service_id: service.id,
      base_price: body.basePrice,
      price_type: body.priceType,
      duration_minutes: body.duration,
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ providerService: data, service }, 201)
})

// PUT /:id
services.put('/:id', authMiddleware, requireActiveRole('provider'), zValidator('json', createServiceSchema.partial()), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data, error } = await supabase
    .from('provider_services')
    .update({ base_price: body.basePrice, price_type: body.priceType, duration_minutes: body.duration })
    .eq('service_id', id)
    .eq('provider_id', userId)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ service: data })
})

// DELETE /:id
services.delete('/:id', authMiddleware, requireActiveRole('provider'), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('service_id', id)
    .eq('provider_id', userId)

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Service removed' })
})

export { services as serviceRoutes }
