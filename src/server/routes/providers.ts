import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware, requireActiveRole } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const providers = new Hono()

providers.use('*', authMiddleware)

const searchSchema = z.object({
  service: z.string().optional(),
  area: z.string().optional(),
  minRating: z.coerce.number().optional(),
  maxRate: z.coerce.number().optional(),
  date: z.string().optional(),
})

const updateProfileSchema = z.object({
  businessName: z.string().optional(),
  bio: z.string().optional(),
  hourlyRate: z.number().optional(),
  serviceRadius: z.number().optional(),
  serviceAreas: z.array(z.string()).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
})

const availabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isAvailable: z.boolean(),
  })),
})

// GET / — search providers
providers.get('/', async (c) => {
  const params = c.req.query()

  let query = supabase
    .from('provider_profiles')
    .select('*, user:users(id), services:provider_services(service:services(title, category))')
    .eq('is_verified', true)
    .eq('is_active', true)

  if (params['area']) query = query.contains('service_areas', [params['area']])
  if (params['minRating']) query = query.gte('rating_average', Number(params['minRating']))
  if (params['maxRate']) query = query.lte('hourly_rate', Number(params['maxRate']))
  if (params['service']) {
    // Filter by service category
    query = query.textSearch('business_name', params['service'])
  }

  const { data, error } = await query.order('rating_average', { ascending: false })
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ providers: data })
})

// GET /me/earnings
providers.get('/me/earnings', requireActiveRole('provider'), async (c) => {
  const userId = c.get('userId')
  const period = c.req.query('period') || 'month' // week | month | year

  const now = new Date()
  let startDate: Date
  if (period === 'week') startDate = new Date(now.setDate(now.getDate() - 7))
  else if (period === 'year') startDate = new Date(now.setFullYear(now.getFullYear() - 1))
  else startDate = new Date(now.setMonth(now.getMonth() - 1))

  const { data, error } = await supabase
    .from('bookings')
    .select('total_amount, platform_fee, base_amount, completed_at, status')
    .eq('provider_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', startDate.toISOString())

  if (error) throw new HTTPException(400, { message: error.message })

  const gross = data?.reduce((sum, b) => sum + b.total_amount, 0) ?? 0
  const fees = data?.reduce((sum, b) => sum + b.platform_fee, 0) ?? 0
  const net = gross - fees

  return c.json({ earnings: { gross, fees, net, bookings: data?.length, period } })
})

// GET /:id — provider public profile
providers.get('/:id', async (c) => {
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('provider_profiles')
    .select('*, services:provider_services(service:services(*)), reviews:reviews(rating, comment, reviewer:users(customer_profiles(first_name, last_name)))')
    .eq('user_id', id)
    .single()

  if (error) throw new HTTPException(404, { message: 'Provider not found' })
  return c.json({ provider: data })
})

// PUT /profile — update own profile
providers.put('/profile', requireActiveRole('provider'), zValidator('json', updateProfileSchema), async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const { data, error } = await supabase
    .from('provider_profiles')
    .update({
      business_name: body.businessName,
      bio: body.bio,
      hourly_rate: body.hourlyRate,
      service_radius: body.serviceRadius,
      service_areas: body.serviceAreas,
      phone: body.phone,
      website: body.website,
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ provider: data })
})

// PUT /availability
providers.put('/availability', requireActiveRole('provider'), zValidator('json', availabilitySchema), async (c) => {
  const userId = c.get('userId')
  const { slots } = c.req.valid('json')

  // Delete existing slots and re-insert
  await supabase.from('availability_slots').delete().eq('provider_id', userId)

  const { data, error } = await supabase
    .from('availability_slots')
    .insert(slots.map((s) => ({ provider_id: userId, day_of_week: s.dayOfWeek, start_time: s.startTime, end_time: s.endTime, is_available: s.isAvailable })))
    .select()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ slots: data })
})

export { providers as providerRoutes }
