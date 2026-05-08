import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const auth = new Hono()

const signupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  primaryRole: z.enum(['customer', 'provider', 'landlord', 'tenant']),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  businessName: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const switchRoleSchema = z.object({
  role: z.enum(['customer', 'provider', 'landlord', 'tenant']),
})

// POST /api/v1/auth/signup
auth.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, phone, password, primaryRole, firstName, lastName, businessName } = c.req.valid('json')

  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, phone })

  if (authError) throw new HTTPException(400, { message: authError.message })
  if (!authData.user) throw new HTTPException(400, { message: 'Failed to create user' })

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      phone,
      roles: [primaryRole],
      active_role: primaryRole,
      primary_role: primaryRole,
    })
    .select()
    .single()

  if (userError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new HTTPException(400, { message: userError.message })
  }

  await createRoleProfile(authData.user.id, primaryRole, { firstName, lastName, businessName })

  return c.json({ user, session: authData.session }, 201)
})

// POST /api/v1/auth/login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) throw new HTTPException(401, { message: 'Invalid credentials' })

  const { data: user } = await supabase
    .from('users')
    .select('*, customer_profiles(*), provider_profiles(*), landlord_profiles(*), tenant_profiles(*)')
    .eq('id', data.user.id)
    .single()

  return c.json({ user, session: data.session })
})

// POST /api/v1/auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const { error } = await supabase.auth.signOut()
  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ message: 'Logged out successfully' })
})

// POST /api/v1/auth/switch-role
auth.post('/switch-role', authMiddleware, zValidator('json', switchRoleSchema), async (c) => {
  const userId = c.get('userId')
  const { role } = c.req.valid('json')

  const { data: user } = await supabase
    .from('users')
    .select('roles')
    .eq('id', userId)
    .single()

  if (!user?.roles.includes(role)) {
    throw new HTTPException(400, { message: 'User does not have this role' })
  }

  const { data: updatedUser, error } = await supabase
    .from('users')
    .update({ active_role: role })
    .eq('id', userId)
    .select('*, customer_profiles(*), provider_profiles(*), landlord_profiles(*), tenant_profiles(*)')
    .single()

  if (error) throw new HTTPException(400, { message: error.message })

  return c.json({ user: updatedUser })
})

// GET /api/v1/auth/me
auth.get('/me', authMiddleware, async (c) => {
  return c.json({ user: c.get('user') })
})

async function createRoleProfile(
  userId: string,
  role: string,
  data: { firstName: string; lastName: string; businessName?: string }
) {
  switch (role) {
    case 'customer':
      return supabase.from('customer_profiles').insert({ user_id: userId, first_name: data.firstName, last_name: data.lastName })
    case 'provider':
      return supabase.from('provider_profiles').insert({ user_id: userId, first_name: data.firstName, last_name: data.lastName, business_name: data.businessName || `${data.firstName} ${data.lastName}` })
    case 'landlord':
      return supabase.from('landlord_profiles').insert({ user_id: userId, first_name: data.firstName, last_name: data.lastName })
    case 'tenant':
      return supabase.from('tenant_profiles').insert({ user_id: userId, first_name: data.firstName, last_name: data.lastName })
  }
}

export { auth as authRoutes }
