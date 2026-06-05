import { NextRequest, NextResponse } from 'next/server'
import { algoliasearch } from 'algoliasearch'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!)

  const { data: providers, error } = await supabase
    .from('provider_profiles')
    .select('id, user_id, business_name, first_name, last_name, bio, hourly_rate, rating_average, total_reviews, profile_image_url, trade_category, trade_categories, base_location, service_areas, is_verified, jobs_completed')
    .eq('verification_status', 'verified')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Batch-fetch approved documents for all providers
  const providerIds = (providers ?? []).map((p: any) => p.id)
  let docsByProvider: Record<string, string[]> = {}
  if (providerIds.length > 0) {
    const { data: docs } = await supabase
      .from('provider_documents')
      .select('provider_id, document_type')
      .in('provider_id', providerIds)
      .eq('status', 'approved')
    ;(docs ?? []).forEach((d: any) => {
      if (!docsByProvider[d.provider_id]) docsByProvider[d.provider_id] = []
      docsByProvider[d.provider_id].push(d.document_type)
    })
  }

  // Batch-fetch group_slug for categories referenced by providers
  const allSlugs = [...new Set((providers ?? []).flatMap((p: any) => {
    const slugs = Array.isArray(p.trade_categories) && p.trade_categories.length > 0
      ? p.trade_categories : p.trade_category ? [p.trade_category] : []
    return slugs
  }))]
  let groupBySlug: Record<string, string> = {}
  if (allSlugs.length > 0) {
    const { data: catRows } = await supabase
      .from('service_categories')
      .select('slug, group_slug')
      .in('slug', allSlugs)
    ;(catRows ?? []).forEach((c: any) => { if (c.group_slug) groupBySlug[c.slug] = c.group_slug })
  }

  const records = (providers ?? []).map((p: any) => {
    const loc = p.base_location as { lat?: number; lng?: number } | null
    const categories: string[] = Array.isArray(p.trade_categories) && p.trade_categories.length > 0
      ? p.trade_categories
      : p.trade_category ? [p.trade_category] : []
    const categoryGroups = [...new Set(categories.map((s: string) => groupBySlug[s]).filter(Boolean))]
    const record: Record<string, any> = {
      objectID:        p.user_id,
      user_id:         p.user_id,
      business_name:   p.business_name ?? `${p.first_name} ${p.last_name}`,
      first_name:      p.first_name,
      last_name:       p.last_name,
      bio:             p.bio ?? '',
      areas:           Array.isArray(p.service_areas) ? p.service_areas : [],
      hourly_rate:     p.hourly_rate ?? 0,
      rating_average:  parseFloat(p.rating_average) ?? 0,
      rating_count:    p.total_reviews ?? 0,
      avatar_url:      p.profile_image_url ?? null,
      categories,
      category_groups: categoryGroups,
      is_verified:     p.is_verified ?? false,
      jobs_completed:  p.jobs_completed ?? 0,
      verified_badges: docsByProvider[p.id] ?? [],
    }
    if (loc?.lat != null && loc?.lng != null) {
      record._geoloc = { lat: loc.lat, lng: loc.lng }
    }
    return record
  })

  await client.saveObjects({ indexName: 'providers', objects: records })

  await client.setSettings({
    indexName: 'providers',
    indexSettings: {
      searchableAttributes: ['business_name', 'first_name', 'last_name', 'bio', 'categories'],
      attributesForFaceting: ['areas', 'categories', 'category_groups', 'hourly_rate', 'rating_average', 'is_verified'],
      customRanking: ['desc(rating_average)', 'desc(rating_count)'],
    },
  })

  return NextResponse.json({ indexed: records.length })
}
