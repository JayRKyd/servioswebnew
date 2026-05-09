import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware, requireRole } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const users = new Hono()
users.use('*', authMiddleware)

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  activeRole: z.enum(['customer', 'provider', 'landlord', 'tenant', 'admin']).optional(),
  avatar: z.string().url().optional(),
})

const addRoleSchema = z.object({
  role: z.enum(['customer', 'provider', 'landlord', 'tenant', 'admin']),
})

const selfAddRoleSchema = z.object({
  role: z.enum(['customer', 'provider', 'landlord', 'tenant']),
})

// POST /api/v1/users/add-role — self-service: add a role to your own account
users.post('/add-role', zValidator('json', selfAddRoleSchema), async (c) => {
  const requestingUser = c.get('user')
  const { role } = c.req.valid('json')
  const id = requestingUser.id

  const { data: current, error: fetchError } = await supabase
    .from('users').select('roles').eq('id', id).single()

  if (fetchError || !current) throw new HTTPException(404, { message: 'User not found' })

  const roles: string[] = current.roles ?? []
  if (roles.includes(role)) return c.json({ message: `You already have the '${role}' role`, roles })

  const updatedRoles = [...roles, role]
  const { data, error } = await supabase
    .from('users')
    .update({ roles: updatedRoles, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, email, roles, active_role')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  // Ensure the role profile row exists
  if (role === 'customer') {
    await supabase.from('customer_profiles').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true })
  } else if (role === 'provider') {
    await supabase.from('provider_profiles').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true })
  } else if (role === 'landlord') {
    await supabase.from('landlord_profiles').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true })
  } else if (role === 'tenant') {
    await supabase.from('tenant_profiles').upsert({ user_id: id }, { onConflict: 'user_id', ignoreDuplicates: true })
  }

  return c.json({ message: `Role '${role}' added`, user: data }, 201)
})

// GET /api/v1/users — admin only
users.get('/', requireRole('admin'), async (c) => {
  const page = Number(c.req.query('page') ?? 1)
  const limit = Number(c.req.query('limit') ?? 20)
  const role = c.req.query('role')
  const search = c.req.query('search')
  const offset = (page - 1) * limit

  let query = supabase
    .from('users')
    .select('*, customer_profiles(*), provider_profiles(*), landlord_profiles(*), tenant_profiles(*)', { count: 'exact' })

  if (role) query = query.contains('roles', [role])
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ users: data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } })
})

// GET /api/v1/users/:id
users.get('/:id', async (c) => {
  const id = c.req.param('id')
  const requestingUser = c.get('user')

  if (requestingUser.id !== id && !requestingUser.roles?.includes('admin')) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const { data, error } = await supabase
    .from('users')
    .select('*, customer_profiles(*), provider_profiles(*), landlord_profiles(*), tenant_profiles(*)')
    .eq('id', id)
    .single()

  if (error) throw new HTTPException(404, { message: 'User not found' })
  return c.json({ user: data })
})

// PUT /api/v1/users/:id
users.put('/:id', zValidator('json', updateUserSchema), async (c) => {
  const id = c.req.param('id')
  const requestingUser = c.get('user')
  const body = c.req.valid('json')

  if (requestingUser.id !== id && !requestingUser.roles?.includes('admin')) {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const payload: Record<string, unknown> = {}
  if (body.firstName !== undefined) payload.first_name = body.firstName
  if (body.lastName !== undefined) payload.last_name = body.lastName
  if (body.phone !== undefined) payload.phone = body.phone
  if (body.avatar !== undefined) payload.avatar = body.avatar
  if (body.activeRole !== undefined) {
    const { data: cur } = await supabase.from('users').select('roles').eq('id', id).single()
    if (!cur?.roles?.includes(body.activeRole) && !requestingUser.roles?.includes('admin')) {
      throw new HTTPException(400, { message: `User does not have the '${body.activeRole}' role` })
    }
    payload.active_role = body.activeRole
  }

  const { data, error } = await supabase
    .from('users')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ user: data })
})

// DELETE /api/v1/users/:id — admin only, soft-delete
users.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id')

  const { data, error } = await supabase
    .from('users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, email, is_active')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'User deactivated', user: data })
})

// POST /api/v1/users/:id/add-role — admin only
users.post('/:id/add-role', requireRole('admin'), zValidator('json', addRoleSchema), async (c) => {
  const id = c.req.param('id')
  const { role } = c.req.valid('json')

  const { data: current, error: fetchError } = await supabase
    .from('users').select('roles').eq('id', id).single()

  if (fetchError || !current) throw new HTTPException(404, { message: 'User not found' })

  const roles: string[] = current.roles ?? []
  if (roles.includes(role)) return c.json({ message: `User already has the '${role}' role` })

  const { data, error } = await supabase
    .from('users')
    .update({ roles: [...roles, role], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, email, roles')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: `Role '${role}' added`, user: data }, 201)
})

// DELETE /api/v1/users/:id/roles/:role — admin only
users.delete('/:id/roles/:role', requireRole('admin'), async (c) => {
  const id = c.req.param('id')
  const role = c.req.param('role')

  const { data: current, error: fetchError } = await supabase
    .from('users').select('roles, active_role').eq('id', id).single()

  if (fetchError || !current) throw new HTTPException(404, { message: 'User not found' })

  const updatedRoles = (current.roles ?? []).filter((r: string) => r !== role)
  const newActiveRole = current.active_role === role ? (updatedRoles[0] ?? null) : current.active_role

  const { data, error } = await supabase
    .from('users')
    .update({ roles: updatedRoles, active_role: newActiveRole, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, email, roles, active_role')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: `Role '${role}' removed`, user: data })
})

export { users as userRoutes }
