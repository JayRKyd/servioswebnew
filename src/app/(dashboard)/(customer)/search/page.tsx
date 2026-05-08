'use client'
import { Suspense, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useProviderSearch } from '@/hooks/useProviderSearch'
import { useGeolocation } from '@/hooks/useGeolocation'
import { ProviderFilters } from '@/components/search/ProviderFilters'
import { ProviderCard } from '@/components/search/ProviderCard'

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
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            <p className="mb-2 text-sm font-medium text-gray-500">{total} provider{total !== 1 ? 's' : ''} found</p>
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

            {/* Context banner — shows what the wizard captured */}
            {context && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs text-primary ring-1 ring-blue-100">
                <span>🎯</span>
                <span>Showing providers matched to your job details.</span>
              </div>
            )}

            {results.length === 0 && !loading ? (
              <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">No providers found. Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((p) => (
                  <ProviderCard
                    key={p.user_id}
                    provider={p}
                    isSelected={selectedId === p.user_id}
                    onHover={setSelectedId}
                    context={context}
                  />
                ))}
              </div>
            )}
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
