import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export const errorHandler = (err: Error, c: Context) => {
  console.error('Error:', err)

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    )
  }

  // Supabase errors
  if ('code' in err) {
    const supabaseError = err as any
    return c.json(
      {
        error: supabaseError.message || 'Database error',
        code: supabaseError.code,
      },
      400
    )
  }

  return c.json(
    {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  )
}
