import type { Context, Next } from 'hono'
import { supabase } from '../db/client'
import { HTTPException } from 'hono/http-exception'

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Unauthorized - No token provided' })
  }

  const token = authHeader.substring(7)

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new HTTPException(401, { message: 'Unauthorized - Invalid token' })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*, customer_profiles(*), provider_profiles(*), landlord_profiles(*), tenant_profiles(*)')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      throw new HTTPException(404, { message: 'User not found' })
    }

    c.set('user', userProfile)
    c.set('userId', user.id)
    c.set('activeRole', userProfile.active_role)

    await next()
  } catch (error) {
    if (error instanceof HTTPException) throw error
    throw new HTTPException(401, { message: 'Unauthorized - Token verification failed' })
  }
}

// Re-export from roles for convenience
export { requireRole, requireActiveRole } from './roles'
