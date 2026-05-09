import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const settings = new Hono()

const commissionSchema = z.object({
  standard:  z.number().min(0).max(50),
  preferred: z.number().min(0).max(50),
  emergency: z.number().min(0).max(50),
})

// GET /api/v1/settings/commission
settings.get('/commission', async (c) => {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'commission_rates')
    .single()

  const rates = (data?.value as any) ?? { standard: 12, preferred: 10, emergency: 15 }
  return c.json({ rates })
})

// PATCH /api/v1/settings/commission — admin only
settings.patch('/commission', authMiddleware, zValidator('json', commissionSchema), async (c) => {
  const userId = c.get('userId')

  const { data: user } = await supabase
    .from('users')
    .select('active_role')
    .eq('id', userId)
    .single()

  if (user?.active_role !== 'admin') {
    throw new HTTPException(403, { message: 'Admin only' })
  }

  const rates = c.req.valid('json')

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'commission_rates', value: rates, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) throw new HTTPException(500, { message: error.message })

  return c.json({ rates })
})

export { settings as settingsRoutes }
