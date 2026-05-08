import { Hono } from 'hono'
import { algoliasearch } from 'algoliasearch'
import { supabase } from '../db/client'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const search = new Hono()

function getAlgoliaClient() {
  const appId    = process.env.ALGOLIA_APP_ID
  const adminKey = process.env.ALGOLIA_ADMIN_KEY
  if (!appId || !adminKey) throw new HTTPException(503, { message: 'Algolia not configured' })
  return algoliasearch(appId, adminKey)
}

/**
 * POST /api/v1/search/sync
 * Syncs all verified providers to Algolia.
 * Protected by admin role check.
 */
search.post('/sync', async (c) => {
  const secret = c.req.header('x-sync-secret')
  if (!secret || secret !== process.env.SYNC_SECRET) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const client = getAlgoliaClient()

  const { data: providers, error } = await supabase
    .from('provider_profiles')
    .select('user_id, business_name, first_name, last_name, bio, trade_category, hourly_rate, rating_average, total_reviews, profile_image_url, verification_status, availability_status')
    .eq('verification_status', 'verified')
    .eq('availability_status', 'available')

  if (error) throw new HTTPException(400, { message: error.message })

  const TRADE_CATEGORY_MAP: Record<string, string> = {
    plumber:      'Plumbing',
    electrician:  'Electrical',
    hvac:         'HVAC',
    painter:      'Painting',
    carpenter:    'Carpentry',
    cleaner:      'Cleaning',
    landscaper:   'Landscaping',
    roofer:       'Roofing',
    pest_control: 'Pest Control',
    security:     'Security',
    handyman:     'Handyman',
  }

  const records = (providers ?? []).map((p: any) => ({
    objectID:       p.user_id,
    user_id:        p.user_id,
    business_name:  p.business_name ?? `${p.first_name} ${p.last_name}`,
    first_name:     p.first_name,
    last_name:      p.last_name,
    bio:            p.bio ?? '',
    hourly_rate:    p.hourly_rate ?? 0,
    rating_average: p.rating_average ?? 0,
    rating_count:   p.total_reviews ?? 0,
    avatar_url:     p.profile_image_url ?? null,
    categories:     p.trade_category ? [TRADE_CATEGORY_MAP[p.trade_category] ?? p.trade_category] : [],
    islands:        [],
  }))

  await client.saveObjects({ indexName: 'providers', objects: records })

  await client.setSettings({
    indexName: 'providers',
    indexSettings: {
      searchableAttributes: ['business_name', 'first_name', 'last_name', 'bio', 'categories'],
      attributesForFaceting: ['categories', 'rating_average'],
      customRanking: ['desc(rating_average)', 'desc(rating_count)'],
    },
  })

  return c.json({ indexed: records.length })
})

/**
 * POST /api/v1/search/upsert/:userId
 * Upsert a single provider in the Algolia index.
 * Called after profile updates.
 */
search.post('/upsert/:userId', authMiddleware, async (c) => {
  const userId = c.req.param('userId')
  const callerUserId = c.get('userId')
  const activeRole   = c.get('activeRole')

  if (callerUserId !== userId && activeRole !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const { data: p, error } = await supabase
    .from('provider_profiles')
    .select(`
      user_id, business_name, first_name, last_name, bio,
      islands, hourly_rate, rating_average, rating_count,
      is_verified, is_active, avatar_url,
      service_offerings ( services ( name, category ) )
    `)
    .eq('user_id', userId)
    .single()

  if (error || !p) throw new HTTPException(404, { message: 'Provider not found' })

  if (!p.is_active || !p.is_verified) {
    // Remove from index if deactivated
    const index = getAlgoliaIndex()
    await index.deleteObject(userId)
    return c.json({ removed: true })
  }

  const categories = [...new Set(
    (p.service_offerings ?? []).flatMap((so: any) => so.services ? [so.services.category] : [])
  )]

  const index = getAlgoliaIndex()
  await index.saveObject({
    objectID: p.user_id, user_id: p.user_id,
    business_name: p.business_name ?? `${p.first_name} ${p.last_name}`,
    first_name: p.first_name, last_name: p.last_name,
    bio: p.bio ?? '', islands: p.islands ?? [],
    hourly_rate: p.hourly_rate ?? 0,
    rating_average: p.rating_average ?? 0, rating_count: p.rating_count ?? 0,
    avatar_url: p.avatar_url ?? null, categories,
  })

  return c.json({ upserted: true })
})

export { search as searchRoutes }
