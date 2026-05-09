'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { algoliaConfigured, searchClient, PROVIDERS_INDEX } from '@/lib/algolia'

export type ProviderHit = {
  objectID: string
  user_id: string
  business_name: string
  first_name: string
  last_name: string
  bio: string
  areas: string[]
  hourly_rate: number
  rating_average: number
  rating_count: number
  categories: string[]
  avatar_url: string | null
  _geoloc?: { lat: number; lng: number }
  _rankingInfo?: { geoDistance?: number }
}

export type SearchFilters = {
  category: string
  minRating: number
  maxPrice: number
  area: string
  sortBy: 'rating' | 'price_asc' | 'price_desc' | 'distance'
  aroundLat?: number
  aroundLng?: number
  aroundRadius?: number // metres
}

const DEFAULT_FILTERS: SearchFilters = {
  category: '',
  minRating: 0,
  maxPrice: 1000,
  area: '',
  sortBy: 'rating',
}

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
        await searchAlgolia(q, f)
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
    if (f.category) facetFilters.push([`categories:${f.category}`])
    if (f.area)     facetFilters.push([`areas:${f.area}`])

    const numericFilters: string[] = []
    if (f.minRating > 0)   numericFilters.push(`rating_average >= ${f.minRating}`)
    if (f.maxPrice < 1000) numericFilters.push(`hourly_rate <= ${f.maxPrice}`)

    const params: Record<string, any> = {
      facetFilters,
      numericFilters,
      hitsPerPage: 40,
      getRankingInfo: true,
    }

    if (f.aroundLat != null && f.aroundLng != null) {
      params.aroundLatLng = `${f.aroundLat},${f.aroundLng}`
      const radius = f.aroundRadius ?? 50000
      params.aroundRadius = radius > 0 ? radius : 50000
    }

    const { hits, nbHits } = await searchClient.searchForHits<ProviderHit>({
      requests: [{ indexName: PROVIDERS_INDEX, query: q, ...params }],
    }).then(r => ({ hits: r.results[0]?.hits ?? [], nbHits: r.results[0]?.nbHits ?? 0 }))

    let sorted = [...hits]
    if (f.sortBy === 'price_asc')  sorted.sort((a, b) => a.hourly_rate - b.hourly_rate)
    if (f.sortBy === 'price_desc') sorted.sort((a, b) => b.hourly_rate - a.hourly_rate)
    if (f.sortBy === 'rating')     sorted.sort((a, b) => b.rating_average - a.rating_average)
    setResults(sorted)
    setTotal(nbHits)
  }

  async function searchSupabase(q: string, f: SearchFilters) {
    let builder = supabase
      .from('provider_profiles')
      .select('user_id, business_name, first_name, last_name, bio, trade_category, hourly_rate, rating_average, total_reviews, profile_image_url')
      .eq('verification_status', 'verified')

    if (q.trim()) {
      builder = builder.or(`business_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,trade_category.ilike.%${q}%`)
    }
    if (f.minRating > 0) builder = builder.gte('rating_average', f.minRating)

    builder = builder.order('rating_average', { ascending: false })

    const { data, error } = await builder.limit(40)
    if (error) throw error
    const rows = data ?? []
    setResults(rows.map((p: any) => ({
      ...p,
      objectID:     p.user_id,
      avatar_url:   p.profile_image_url,
      rating_count: p.total_reviews,
      areas:        [],
      categories:   p.trade_category ? [p.trade_category] : [],
    })))
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

  return { query, setQuery, filters, updateFilter, setMapBounds, results, total, loading, error }
}
