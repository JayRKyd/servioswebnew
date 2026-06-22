'use client'
import { Suspense, useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useProviderSearch } from '@/hooks/useProviderSearch'
import { useGeolocation } from '@/hooks/useGeolocation'
import { ProviderFilters } from '@/components/search/ProviderFilters'
import { ProviderCard, AirbnbProviderCard } from '@/components/search/ProviderCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProviderHit } from '@/hooks/useProviderSearch'

const MOCK_PROVIDERS: ProviderHit[] = [
  { objectID: 'm1', user_id: 'm1', first_name: 'James',  last_name: 'Taylor',   business_name: '',              bio: 'Experienced plumber with 12+ years on residential and commercial jobs.',  islands: ['Central London'], hourly_rate: 75,  rating_average: 4.9, rating_count: 28, categories: ['Plumbing'],     avatar_url: null },
  { objectID: 'm2', user_id: 'm2', first_name: 'Sarah',  last_name: 'Mitchell', business_name: 'CleanPro Ltd',  bio: 'Professional deep-cleaning and end-of-tenancy specialists.',               islands: ['North London'],   hourly_rate: 38,  rating_average: 4.7, rating_count: 14, categories: ['Cleaning'],     avatar_url: null },
  { objectID: 'm3', user_id: 'm3', first_name: 'Mike',   last_name: 'Chen',     business_name: 'Chen Electrics',bio: 'Fully qualified electrician. NICEIC approved contractor.',                  islands: ['South London'],   hourly_rate: 85,  rating_average: 5.0, rating_count: 41, categories: ['Electrical'],   avatar_url: null },
  { objectID: 'm4', user_id: 'm4', first_name: 'Emma',   last_name: 'Clarke',   business_name: '',              bio: 'Interior and exterior painting. Neat, reliable, and great value.',          islands: ['East London'],    hourly_rate: 50,  rating_average: 4.6, rating_count: 9,  categories: ['Painting'],    avatar_url: null },
  { objectID: 'm5', user_id: 'm5', first_name: 'David',  last_name: 'Brown',    business_name: 'Brown HVAC',    bio: 'Heating, ventilation & AC installation and servicing.',                    islands: ['West London'],    hourly_rate: 90,  rating_average: 4.8, rating_count: 22, categories: ['HVAC'],        avatar_url: null },
  { objectID: 'm6', user_id: 'm6', first_name: 'Lisa',   last_name: 'Johnson',  business_name: '',              bio: 'Versatile handyman — flat-pack, tiling, minor repairs, and more.',         islands: ['Central London'], hourly_rate: 55,  rating_average: 4.5, rating_count: 6,  categories: ['Handyman'],    avatar_url: null },
]

// mapbox-gl touches browser globals at import time — must skip SSR
const ProviderMap = dynamic(
  () => import('@/components/search/ProviderMap').then((m) => m.ProviderMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-xl bg-gray-100" /> }
)

type ViewMode = 'list' | 'map' | 'split'

export default function SearchPage() {
  return <Suspense fallback={null}><SearchPageInner /></Suspense>
}
function SearchPageInner() {
  const searchParams = useSearchParams()

  const {
    query, setQuery,
    filters, updateFilter, setMapBounds,
    results, total, loading, error,
  } = useProviderSearch()

  const { location, loading: geoLoading, granted: geoGranted, requestLocation } = useGeolocation()
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollCards(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 528 : -528, behavior: 'smooth' })
  }

  // Pre-apply category filter if coming from /book wizard
  const categoryParam = searchParams.get('category')
  const context       = searchParams.get('context') ?? ''

  useEffect(() => {
    if (categoryParam) updateFilter('category', categoryParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam])

  // When location becomes available, apply it to search bounds
  useEffect(() => {
    if (location) {
      setMapBounds(location.lat, location.lng, 50_000)
      updateFilter('sortBy', 'distance')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const handleRequestLocation = useCallback(() => {
    requestLocation()
  }, [requestLocation])

  const handleBoundsChange = useCallback((lat: number, lng: number, radius: number) => {
    setMapBounds(lat, lng, radius)
  }, [setMapBounds])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden">
      {/* Search bar + view toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search providers, services…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {(['list', 'split', 'map'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={
                'px-3 py-2 text-xs font-medium capitalize transition ' +
                (viewMode === mode ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50')
              }
            >
              {mode === 'list' ? '☰ List' : mode === 'split' ? '⊟ Split' : '🗺 Map'}
            </button>
          ))}
        </div>
      </div>

      {/* Body: filters sidebar + results */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Filters sidebar — hide in map-only mode */}
        {viewMode !== 'map' && (
          <div className="hidden w-64 shrink-0 overflow-y-auto lg:block">
            <ProviderFilters
              filters={filters}
              onChange={updateFilter}
              total={total}
              locationGranted={geoGranted}
              onRequestLocation={handleRequestLocation}
            />
          </div>
        )}

        {/* List panel */}
        {(viewMode === 'list' || viewMode === 'split') && (
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">

            {/* Row header */}
            <div className="flex items-center justify-between shrink-0">
              <p className="text-sm font-medium text-gray-500">
                {results.length > 0 ? `${total} provider${total !== 1 ? 's' : ''} found` : 'Featured providers'}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => scrollCards('left')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow disabled:opacity-30"
                  aria-label="Scroll left"
                >
                  <ChevronLeft size={16} className="text-dark" />
                </button>
                <button
                  onClick={() => scrollCards('right')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow"
                  aria-label="Scroll right"
                >
                  <ChevronRight size={16} className="text-dark" />
                </button>
              </div>
            </div>

            {/* Context banner */}
            {context && (
              <div className="shrink-0 flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs text-primary ring-1 ring-primary/10">
                <span>🎯</span>
                <span>Showing providers matched to your job details.</span>
              </div>
            )}

            {error && <p className="shrink-0 text-sm text-red-500">{error}</p>}

            {/* Airbnb card row */}
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(results.length > 0 ? results : MOCK_PROVIDERS).map((p) => (
                <AirbnbProviderCard
                  key={p.user_id}
                  provider={p}
                  isSelected={selectedId === p.user_id}
                  onHover={setSelectedId}
                  context={context}
                />
              ))}
            </div>
          </div>
        )}

        {/* Map panel */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'hidden lg:block lg:w-[42%] shrink-0' : 'flex-1'}>
            <ProviderMap
              providers={results}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBoundsChange={handleBoundsChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
