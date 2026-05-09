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
 * POST /api/v1/search/upsert/:userId
 * Upsert (or remove) a single provider in the Algolia index.
 * Called after profile updates. Only indexes verified providers.
 */
search.post('/upsert/:userId', authMiddleware, async (c) => {
  const userId       = c.req.param('userId')
  const callerUserId = c.get('userId')
  const activeRole   = c.get('activeRole')

  if (callerUserId !== userId && activeRole !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden' })
  }

  const { data: p, error } = await supabase
    .from('provider_profiles')
    .select(
      'user_id, business_name, first_name, last_name, bio, trade_category, ' +
      'hourly_rate, rating_average, total_reviews, profile_image_url, ' +
      'verification_status, availability_status, service_areas, base_location'
    )
    .eq('user_id', userId)
    .single()

  if (error || !p) throw new HTTPException(404, { message: 'Provider not found' })

  const client = getAlgoliaClient()

  if (p.verification_status !== 'verified') {
    await client.deleteObjects({ indexName: 'providers', objectIDs: [userId] })
    return c.json({ removed: true })
  }

  const loc = p.base_location as { lat?: number; lng?: number } | null
  const record: Record<string, unknown> = {
    objectID:       p.user_id,
    user_id:        p.user_id,
    business_name:  p.business_name ?? `${p.first_name} ${p.last_name}`,
    first_name:     p.first_name,
    last_name:      p.last_name,
    bio:            p.bio ?? '',
    areas:          Array.isArray(p.service_areas) ? p.service_areas : [],
    hourly_rate:    p.hourly_rate ?? 0,
    rating_average: parseFloat(p.rating_average) ?? 0,
    rating_count:   p.total_reviews ?? 0,
    avatar_url:     p.profile_image_url ?? null,
    categories:     p.trade_category ? [p.trade_category] : [],
  }

  if (loc?.lat != null && loc?.lng != null) {
    record._geoloc = { lat: loc.lat, lng: loc.lng }
  }

  await client.saveObjects({ indexName: 'providers', objects: [record] })

  return c.json({ upserted: true })
})

export { search as searchRoutes }
