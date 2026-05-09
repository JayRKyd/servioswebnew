import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const onboarding = new Hono()

onboarding.use('*', authMiddleware)

// ─── GET /api/v1/onboarding/trades ──────────────────────────────────────────
// Returns list of available trades (for the trade picker screen)
onboarding.get('/trades', async (c) => {
  const { data, error } = await supabase
    .from('trade_service_templates')
    .select('trade')
    .order('trade')

  if (error) throw new HTTPException(500, { message: error.message })

  // Unique trade values
  const trades = Array.from(new Set((data ?? []).map((r: any) => r.trade)))

  const TRADE_LABELS: Record<string, string> = {
    plumber:      'Plumber',
    electrician:  'Electrician',
    ac_hvac:      'AC / HVAC',
    carpenter:    'Carpenter',
    painter:      'Painter',
    cleaner:      'Cleaner',
    landscaper:   'Landscaper',
    mason:        'Mason / Builder',
    roofer:       'Roofer',
    handyman:     'Handyman',
  }

  return c.json({
    trades: trades.map((t) => ({ value: t, label: TRADE_LABELS[t] ?? t })),
  })
})

// ─── GET /api/v1/onboarding/templates/:trade ─────────────────────────────────
// Returns service templates for a given trade
onboarding.get('/templates/:trade', async (c) => {
  const { trade } = c.req.param()

  const { data, error } = await supabase
    .from('trade_service_templates')
    .select('id, name, description, price_min, price_max, price_type')
    .eq('trade', trade)
    .order('sort_order')

  if (error) throw new HTTPException(500, { message: error.message })

  return c.json({ templates: data ?? [] })
})

// ─── GET /api/v1/onboarding/status ──────────────────────────────────────────
// Returns the provider's current onboarding state
onboarding.get('/status', async (c) => {
  const userId = c.get('userId')

  const { data, error } = await supabase
    .from('provider_profiles')
    .select('trade_category, onboarding_complete, onboarding_step')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return c.json({ onboarding_complete: false, onboarding_step: 'trade', trade_category: null })
  }

  return c.json(data)
})

// ─── POST /api/v1/onboarding/trade ──────────────────────────────────────────
// Step 1: save chosen trade category
onboarding.post(
  '/trade',
  zValidator('json', z.object({ trade: z.string().min(1) })),
  async (c) => {
    const userId = c.get('userId')
    const { trade } = c.req.valid('json')

    const { error } = await supabase
      .from('provider_profiles')
      .update({ trade_category: trade, onboarding_step: 'services' })
      .eq('user_id', userId)

    if (error) throw new HTTPException(500, { message: error.message })

    return c.json({ success: true, next_step: 'services' })
  }
)

// ─── POST /api/v1/onboarding/services ───────────────────────────────────────
// Step 2: save selected services (from templates + any custom)
const serviceSchema = z.object({
  templateId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  priceType: z.enum(['fixed', 'hourly', 'quote']),
})

onboarding.post(
  '/services',
  zValidator('json', z.object({ services: z.array(serviceSchema).min(1) })),
  async (c) => {
    const userId = c.get('userId')
    const { services } = c.req.valid('json')

    // Delete any previously saved onboarding services and replace
    await supabase
      .from('provider_trade_services')
      .delete()
      .eq('provider_id', userId)

    const rows = services.map((s) => ({
      provider_id: userId,
      template_id: s.templateId ?? null,
      name: s.name,
      description: s.description ?? null,
      price: s.price,
      price_type: s.priceType,
      is_active: true,
    }))

    const { error } = await supabase.from('provider_trade_services').insert(rows)
    if (error) throw new HTTPException(500, { message: error.message })

    // Advance onboarding step
    await supabase
      .from('provider_profiles')
      .update({ onboarding_step: 'documents' })
      .eq('user_id', userId)

    return c.json({ success: true, next_step: 'documents' })
  }
)

// ─── POST /api/v1/onboarding/submit ──────────────────────────────────────────
// Step 4 (after documents): submit for admin review
onboarding.post('/submit', async (c) => {
  const userId = c.get('userId')

  const { error } = await supabase
    .from('provider_profiles')
    .update({ onboarding_step: 'complete', onboarding_complete: false })
    // onboarding_complete stays false until admin approves
    .eq('user_id', userId)

  if (error) throw new HTTPException(500, { message: error.message })

  return c.json({ success: true, message: 'Application submitted for review' })
})

export { onboarding as onboardingRoutes }
