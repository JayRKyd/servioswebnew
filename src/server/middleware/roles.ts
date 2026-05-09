import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const requireRole = (...allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' })
    }

    const hasRole = user.roles.some((role: string) => allowedRoles.includes(role))

    if (!hasRole) {
      throw new HTTPException(403, { message: 'Forbidden - Insufficient permissions' })
    }

    await next()
  }
}

export const requireActiveRole = (...allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const activeRole = c.get('activeRole')

    if (!allowedRoles.includes(activeRole)) {
      throw new HTTPException(403, {
        message: `Forbidden - This action requires one of: ${allowedRoles.join(', ')}`,
      })
    }

    await next()
  }
}
