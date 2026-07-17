'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { algoliaConfigured, searchClient, PROVIDERS_INDEX } from '@/lib/algolia'
import { profileCompletenessScore } from '@/lib/profileScore'

export type ProviderHit = {
  objectID: string
  user_id: string
  business_name: string
  first_name: string
  last_name: string
  bio: string
  islands: string[]
  hourly_rate: number
  rating_average: number
  rating_count: number
  jobs_completed?: number
  profile_score?: number
  categories: string[]
  avatar_url: string | null
  _geoloc?: { lat: number; lng: number }
  _rankingInfo?: { geoDistance?: number }
}

export type SearchFilters = {
  category: string
  minRating: number
  maxPrice: number
  island: string
  sortBy: 'rating' | 'price_asc' | 'price_desc' | 'distance'
  aroundLat?: number
  aroundLng?: number
  aroundRadius?: number // metres — used for user geolocation ranking
  insideBoundingBox?: string // "neLat,neLng,swLat,swLng" — used when map is visible
}

const DEFAULT_FILTERS: SearchFilters = {
  category: '',
  minRating: 0,
  maxPrice: 1000,
  island: '',
  sortBy: 'rating',
}

const TRADE_LABELS: Record<string, string> = {
  plumber: 'Plumbing',
  electrician: 'Electrical',
  hvac: 'HVAC',
  painter: 'Painting',
  carpenter: 'Carpentry',
  cleaner: 'Cleaning',
  landscaper: 'Landscaping',
  roofer: 'Roofing',
  pest_control: 'Pest Control',
  security: 'Security',
  handyman: 'Handyman',
}

const TRADE_KEYS = Object.fromEntries(
  Object.entries(TRADE_LABELS).map(([key, label]) => [label, key])
)

export function useProviderSearch() {
  const [query, setQuery]           = useState('')
  const [filters, setFilters]       = useState<SearchFilters>(DEFAULT_FILTERS)
  const [results, setResults]       = useState<ProviderHit[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const search = useCallback(async (q: string, f: SearchFilters) => {
    setLoading(true)
    setError(null)
    try {
      if (algoliaConfigured) {
        try {
          await searchAlgolia(q, f)
        } catch (algoliaError) {
          // Index unreachable/misconfigured — degrade to the database rather
          // than showing an error and zero results
          console.error('Algolia search failed, falling back to database:', algoliaError)
          await searchSupabase(q, f)
        }
      } else {
        await searchSupabase(q, f)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  async function searchAlgolia(q: string, f: SearchFilters) {
    if (!searchClient) { await searchSupabase(q, f); return }

    const facetFilters: string[][] = []
    if (f.category) {
      const storedKey = TRADE_KEYS[f.category]
      facetFilters.push(storedKey
        ? [`categories:${f.category}`, `categories:${storedKey}`]
        : [`categories:${f.category}`])
    }
    if (f.island)   facetFilters.push([`islands:${f.island}`])

    const numericFilters: string[] = []
    if (f.minRating > 0)   numericFilters.push(`rating_average >= ${f.minRating}`)
    if (f.maxPrice < 1000) numericFilters.push(`hourly_rate <= ${f.maxPrice}`)

    const params: Record<string, any> = {
      facetFilters,
      numericFilters,
      hitsPerPage: 40,
      getRankingInfo: true,
    }

    if (f.insideBoundingBox) {
      // Map-driven filter: restrict results to the visible map viewport
      params.insideBoundingBox = f.insideBoundingBox
    }

    if (f.aroundLat != null && f.aroundLng != null) {
      // User geolocation: used for distance ranking (works alongside insideBoundingBox)
      params.aroundLatLng = `${f.aroundLat},${f.aroundLng}`
      params.aroundRadius = f.insideBoundingBox ? 'all' : (f.aroundRadius ?? 50000)
    }

    const { hits, nbHits } = await searchClient.searchForHits<ProviderHit>({
      requests: [{ indexName: PROVIDERS_INDEX, query: q, ...params }],
    }).then(r => ({ hits: r.results[0]?.hits ?? [], nbHits: r.results[0]?.nbHits ?? 0 }))

    // Drop stale index records whose user_id isn't a real UUID (e.g. old seed
    // objects like "p7") — they render cards that 404 on /providers/[id].
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let sorted = hits.filter(h => UUID_RE.test(h.user_id))
    if (f.sortBy === 'price_asc')  sorted.sort((a, b) => a.hourly_rate - b.hourly_rate)
    if (f.sortBy === 'price_desc') sorted.sort((a, b) => b.hourly_rate - a.hourly_rate)
    // "Recommended": rating, then track record, then profile completeness
    if (f.sortBy === 'rating')     sorted.sort((a, b) =>
      (b.rating_average - a.rating_average)
      || ((b.jobs_completed ?? 0) - (a.jobs_completed ?? 0))
      || ((b.profile_score ?? 0) - (a.profile_score ?? 0)))
    setResults(sorted)
    setTotal(sorted.length < hits.length ? sorted.length : nbHits)
  }

  async function searchSupabase(q: string, f: SearchFilters) {
    let builder = supabase
      .from('provider_profiles')
      .select('user_id, business_name, first_name, last_name, bio, trade_category, hourly_rate, rating_average, total_reviews, total_jobs_completed, profile_image_url, service_areas, city, licenses, languages, identity_verified')
      .eq('verification_status', 'verified')

    if (q.trim()) {
      builder = builder.or(`business_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,trade_category.ilike.%${q}%`)
    }
    if (f.minRating > 0) builder = builder.gte('rating_average', f.minRating)
    if (f.maxPrice < 1000) builder = builder.lte('hourly_rate', f.maxPrice)
    if (f.category) builder = builder.eq('trade_category', TRADE_KEYS[f.category] ?? f.category)
    if (f.island) builder = builder.contains('service_areas', [f.island])

    if (f.sortBy === 'price_asc') builder = builder.order('hourly_rate', { ascending: true })
    else if (f.sortBy === 'price_desc') builder = builder.order('hourly_rate', { ascending: false })
    else builder = builder.order('rating_average', { ascending: false }).order('total_jobs_completed', { ascending: false })

    const { data, error } = await builder.limit(40)
    if (error) throw error
    const rows = data ?? []
    const mapped = rows.map((p: any) => ({
      ...p,
      objectID:       p.user_id,
      avatar_url:     p.profile_image_url,
      rating_count:   p.total_reviews,
      jobs_completed: p.total_jobs_completed ?? 0,
      profile_score:  profileCompletenessScore(p),
      islands:      Array.isArray(p.service_areas) ? p.service_areas : [],
      categories:   p.trade_category ? [TRADE_LABELS[p.trade_category] ?? p.trade_category] : [],
    }))
    // "Recommended": complete profiles rank above bare ones when rating and
    // track record tie (the DB order can't see completeness)
    if (f.sortBy === 'rating') {
      mapped.sort((a: any, b: any) =>
        (b.rating_average - a.rating_average)
        || (b.jobs_completed - a.jobs_completed)
        || (b.profile_score - a.profile_score))
    }
    setResults(mapped)
    setTotal(rows.length)
  }

  // Debounced search on query/filter change
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query, filters), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, filters, search])

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function setMapBounds(lat: number, lng: number, radiusMetres: number) {
    setFilters((prev) => ({ ...prev, aroundLat: lat, aroundLng: lng, aroundRadius: radiusMetres }))
  }

  function setMapViewport(ne: { lat: number; lng: number }, sw: { lat: number; lng: number }) {
    setFilters((prev) => ({ ...prev, insideBoundingBox: `${ne.lat},${ne.lng},${sw.lat},${sw.lng}` }))
  }

  function clearMapViewport() {
    setFilters((prev) => ({ ...prev, insideBoundingBox: undefined }))
  }

  return { query, setQuery, filters, updateFilter, setMapBounds, setMapViewport, clearMapViewport, results, total, loading, error }
}
