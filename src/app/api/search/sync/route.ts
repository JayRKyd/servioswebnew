import { NextRequest, NextResponse } from 'next/server'
import { algoliasearch } from 'algoliasearch'
import { createClient } from '@supabase/supabase-js'
import { profileCompletenessScore } from '@/lib/profileScore'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TRADE_CATEGORY_MAP: Record<string, string> = {
  plumber: 'Plumbing', electrician: 'Electrical', hvac: 'HVAC',
  painter: 'Painting', carpenter: 'Carpentry', cleaner: 'Cleaning',
  landscaper: 'Landscaping', roofer: 'Roofing', pest_control: 'Pest Control',
  security: 'Security', handyman: 'Handyman',
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // trim() guards against stray whitespace in env values (the app ID carried
  // a pasted tab that broke the client-side search the same way). The app ID
  // falls back to the public one — same value; only the admin key is extra.
  const appId    = (process.env.ALGOLIA_APP_ID ?? process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? '').trim()
  const adminKey = (process.env.ALGOLIA_ADMIN_KEY ?? '').trim()
  if (!appId) {
    return NextResponse.json({ error: 'ALGOLIA_APP_ID is not configured' }, { status: 500 })
  }
  if (!adminKey) {
    return NextResponse.json(
      { error: 'ALGOLIA_ADMIN_KEY is not configured — add the Admin API key from the Algolia dashboard to the Vercel environment variables' },
      { status: 500 }
    )
  }
  const client = algoliasearch(appId, adminKey)

  const { data: providers, error } = await supabase
    .from('provider_profiles')
    .select('user_id, business_name, first_name, last_name, bio, hourly_rate, rating_average, total_reviews, total_jobs_completed, profile_image_url, trade_category, base_location, service_areas, city, licenses, languages, identity_verified')
    .eq('verification_status', 'verified')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const records = (providers ?? []).map((p: any) => {
    const loc = p.base_location as { lat?: number; lng?: number } | null
    const record: Record<string, any> = {
      objectID:       p.user_id,
      user_id:        p.user_id,
      business_name:  p.business_name?.trim() || `${p.first_name} ${p.last_name}`,
      first_name:     p.first_name,
      last_name:      p.last_name,
      bio:            p.bio ?? '',
      islands:        Array.isArray(p.service_areas) ? p.service_areas : [],
      hourly_rate:    p.hourly_rate ?? 0,
      rating_average: parseFloat(p.rating_average) ?? 0,
      rating_count:   p.total_reviews ?? 0,
      jobs_completed: p.total_jobs_completed ?? 0,
      profile_score:  profileCompletenessScore(p),
      avatar_url:     p.profile_image_url ?? null,
      categories:     p.trade_category ? [TRADE_CATEGORY_MAP[p.trade_category] ?? p.trade_category] : [],
    }
    if (loc?.lat != null && loc?.lng != null) {
      record._geoloc = { lat: loc.lat, lng: loc.lng }
    }
    return record
  })

  try {
    // replaceAllObjects atomically swaps the whole index: adds current verified
    // providers and drops anything stale (e.g. old seed records like "p7").
    await client.replaceAllObjects({ indexName: 'providers', objects: records })

    await client.setSettings({
      indexName: 'providers',
      indexSettings: {
        searchableAttributes: ['business_name', 'first_name', 'last_name', 'bio', 'categories'],
        attributesForFaceting: ['islands', 'categories', 'hourly_rate', 'rating_average'],
        customRanking: ['desc(rating_average)', 'desc(jobs_completed)', 'desc(profile_score)', 'desc(rating_count)'],
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Algolia sync failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ indexed: records.length })
}
