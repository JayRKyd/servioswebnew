import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const pushTokens = new Hono()

pushTokens.use('*', authMiddleware)

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['expo', 'apns', 'fcm']).default('expo'),
})

// POST /api/v1/push-tokens — register a push token for the current user
pushTokens.post('/', zValidator('json', registerSchema), async (c) => {
  const userId = c.get('userId')
  const { token, platform } = c.req.valid('json')

  // Upsert — one token can only belong to one user at a time
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' })

  if (error) throw new HTTPException(400, { message: error.message })
  return c.json({ registered: true })
})

// DELETE /api/v1/push-tokens — remove a push token (on logout)
pushTokens.delete('/', zValidator('json', z.object({ token: z.string() })), async (c) => {
  const userId = c.get('userId')
  const { token } = c.req.valid('json')

  await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token)

  return c.json({ removed: true })
})

export { pushTokens as pushTokenRoutes }
