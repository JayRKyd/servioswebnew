import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware, requireActiveRole } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const properties = new Hono()

properties.use('*', authMiddleware)
properties.use('*', requireActiveRole('landlord', 'admin'))

const createPropertySchema = z.object({
  name: z.string().min(1),
  propertyType: z.enum(['residential', 'commercial', 'vacation_rental', 'multi_unit']),
  address: z.object({
    street: z.string(),
    city: z.string(),
    island: z.string(),
    postalCode: z.string().optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  }),
  units: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  squareFeet: z.number().optional(),
  yearBuilt: z.number().optional(),
  notes: z.string().optional(),
})

// GET /api/v1/properties
properties.get('/', async (c) => {
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('properties')
    .select('*, tenants:tenants(*)')
    .eq('landlord_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ properties: data })
})

// GET /api/v1/properties/:id
properties.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('properties')
    .select('*, tenants:tenants(*), bookings:bookings(*), maintenance_requests:maintenance_requests(*), compliance:property_compliance(*)')
    .eq('id', id)
    .eq('landlord_id', userId)
    .single()

  if (error) throw new HTTPException(404, { message: 'Property not found' })
  return c.json({ property: data })
})

// POST /api/v1/properties
properties.post('/', zValidator('json', createPropertySchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data, error } = await supabase
    .from('properties')
    .insert({
      landlord_id: userId,
      name: body.name,
      property_type: body.propertyType,
      address: body.address,
      units: body.units,
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      square_feet: body.squareFeet,
      year_built: body.yearBuilt,
      notes: body.notes,
    })
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ property: data }, 201)
})

// PUT /api/v1/properties/:id
properties.put('/:id', zValidator('json', createPropertySchema.partial()), async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data, error } = await supabase
    .from('properties')
    .update(body)
    .eq('id', id)
    .eq('landlord_id', userId)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ property: data })
})

// DELETE /api/v1/properties/:id
properties.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { error } = await supabase.from('properties').delete().eq('id', id).eq('landlord_id', userId)
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Property deleted successfully' })
})

// GET /api/v1/properties/:id/history
properties.get('/:id/history', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')

  const { data: property } = await supabase.from('properties').select('id').eq('id', id).eq('landlord_id', userId).single()
  if (!property) throw new HTTPException(403, { message: 'Forbidden' })

  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:provider_profiles(business_name, rating_average), service:services(title), tenant:tenant_profiles(first_name, last_name)')
    .eq('property_id', id)
    .order('scheduled_date', { ascending: false })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ history: data })
})

export { properties as propertyRoutes }
