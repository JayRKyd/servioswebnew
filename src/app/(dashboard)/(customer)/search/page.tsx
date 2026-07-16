'use client'
import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useProviderSearch } from '@/hooks/useProviderSearch'
import { useGeolocation } from '@/hooks/useGeolocation'
import { usePortfolioThumbs } from '@/hooks/usePortfolioThumbs'
import { AirbnbProviderCard, ProviderCard } from '@/components/search/ProviderCard'
import {
  ChevronLeft, ChevronRight, Search, SlidersHorizontal, Map as MapIcon, X, MapPin,
} from 'lucide-react'
import type { ProviderHit, SearchFilters } from '@/hooks/useProviderSearch'

const ProviderMap = dynamic(
  () => import('@/components/search/ProviderMap').then((m) => m.ProviderMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-2xl bg-gray-100" /> }
)

const CATEGORY_ORDER = ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'HVAC']
const AREAS = ['', 'Central London', 'North London', 'South London', 'East London', 'West London']
const SORT_OPTIONS = [
  { value: 'rating',     label: 'Top Rated' },
  { value: 'price_asc',  label: 'Price: Low–High' },
  { value: 'price_desc', label: 'Price: High–Low' },
  { value: 'distance',   label: 'Nearest First' },
] as const

// ─── Filters modal ─────────────────────────────────────────────────────────────
function FiltersModal({
  filters,
  onChange,
  providerCount,
  locationGranted,
  onRequestLocation,
  onClose,
}: {
  filters: SearchFilters
  onChange: <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => void
  providerCount: number
  locationGranted: boolean
  onRequestLocation: () => void
  onClose: () => void
}) {
  const hasActive = filters.island !== '' || filters.minRating > 0 || filters.maxPrice < 1000 || filters.sortBy !== 'rating'

  function clearAll() {
    onChange('island', '')
    onChange('minRating', 0)
    onChange('maxPrice', 1000)
    onChange('sortBy', 'rating')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl flex flex-col shadow-2xl max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-bold text-dark">Filters</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-dark" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Sort by */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => onChange('sortBy', o.value)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    filters.sortBy === o.value
                      ? 'border-dark bg-dark text-white'
                      : 'border-gray-300 text-dark hover:border-dark'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Max hourly rate */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Max hourly rate:{' '}
              <span className="font-semibold text-dark normal-case tracking-normal">
                {filters.maxPrice < 1000 ? `£${filters.maxPrice}/hr` : 'Any'}
              </span>
            </p>
            <input
              type="range" min="0" max="1000" step="25"
              value={filters.maxPrice}
              onChange={e => onChange('maxPrice', parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>£0</span><span>£1000+</span>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Min rating */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Minimum rating:{' '}
              <span className="font-semibold text-dark normal-case tracking-normal">
                {filters.minRating > 0 ? `${filters.minRating.toFixed(1)} stars` : 'Any'}
              </span>
            </p>
            <input
              type="range" min="0" max="5" step="0.5"
              value={filters.minRating}
              onChange={e => onChange('minRating', parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>Any</span><span>5 stars</span>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Area */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Area</p>
            <div className="flex flex-wrap gap-2">
              {AREAS.map(a => (
                <button
                  key={a || 'all'}
                  onClick={() => onChange('island', a)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                    filters.island === a
                      ? 'border-dark bg-dark text-white'
                      : 'border-gray-300 text-dark hover:border-dark'
                  }`}
                >
                  {a || 'All Areas'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Location */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Location</p>
            {locationGranted ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-3 text-sm text-primary ring-1 ring-primary/10">
                <MapPin size={14} className="shrink-0" />
                <span>Using your location for distance sorting</span>
              </div>
            ) : (
              <button
                onClick={onRequestLocation}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
              >
                <MapPin size={14} className="shrink-0" />
                Use my location
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={clearAll}
            disabled={!hasActive}
            className={`text-sm font-semibold underline transition-colors ${
              hasActive ? 'text-dark hover:text-primary' : 'cursor-default text-gray-300'
            }`}
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-dark/90 transition-colors"
          >
            Show {providerCount} provider{providerCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SearchPage() {
  return <Suspense fallback={null}><SearchPageInner /></Suspense>
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const { query, setQuery, filters, updateFilter, setMapBounds, setMapViewport, clearMapViewport, results, total, loading, error } = useProviderSearch()
  const { location, granted: geoGranted, requestLocation } = useGeolocation()
  const [showMap, setShowMap]         = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentMapBounds, setCurrentMapBounds] = useState<{
    ne: { lat: number; lng: number }
    sw: { lat: number; lng: number }
  } | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const ITEMS_PER_PAGE = 6

  const categoryParam = searchParams.get('category')
  const islandParam   = searchParams.get('island')
  const context       = searchParams.get('context') ?? ''
  const qParam        = searchParams.get('q')

  useEffect(() => {
    if (categoryParam) updateFilter('category', categoryParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam])

  // Free-text handoff (e.g. homepage search terms that don't map to a trade)
  useEffect(() => {
    if (qParam) setQuery(qParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam])

  useEffect(() => {
    if (islandParam) updateFilter('island', islandParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [islandParam])

  // Reset to page 1 whenever category changes
  useEffect(() => { setCurrentPage(1) }, [filters.category])

  useEffect(() => {
    if (location) {
      setMapBounds(location.lat, location.lng, 50_000)
      updateFilter('sortBy', 'distance')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const handleRequestLocation = useCallback(() => requestLocation(), [requestLocation])
  const handleBoundsChange    = useCallback(
    (ne: { lat: number; lng: number }, sw: { lat: number; lng: number }) => {
      setCurrentMapBounds({ ne, sw })
      setMapViewport(ne, sw)
    },
    [setMapViewport]
  )

  function openMap()  { setShowMap(true) }
  function closeMap() { setShowMap(false); setCurrentMapBounds(null); clearMapViewport() }

  function isInMapBounds(p: ProviderHit): boolean {
    if (!currentMapBounds || !p._geoloc) return true
    const { ne, sw } = currentMapBounds
    return (
      p._geoloc.lat <= ne.lat &&
      p._geoloc.lat >= sw.lat &&
      p._geoloc.lng <= ne.lng &&
      p._geoloc.lng >= sw.lng
    )
  }

  function scrollRow(cat: string, dir: 'left' | 'right') {
    rowRefs.current[cat]?.scrollBy({ left: dir === 'right' ? 536 : -536, behavior: 'smooth' })
  }

  const displayProviders: ProviderHit[] = results
  const portfolioThumbs = usePortfolioThumbs(
    useMemo(() => results.filter(p => !p.avatar_url).map(p => p.user_id), [results])
  )

  const grouped = useMemo(() => {
    const map = new Map<string, ProviderHit[]>()
    const orderedCats = filters.category ? [filters.category] : CATEGORY_ORDER
    for (const cat of orderedCats) map.set(cat, [])
    for (const p of displayProviders) {
      const cat = p.categories[0] ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    for (const [k, v] of map.entries()) { if (v.length === 0) map.delete(k) }
    return map
  }, [displayProviders, filters.category])

  const providerCount = total > 0 ? total : displayProviders.length

  // Map mode: split providers into in-viewport vs outside
  const inBoundsProviders  = showMap ? displayProviders.filter(p => isInMapBounds(p))  : displayProviders
  const outBoundsProviders = showMap ? displayProviders.filter(p => !isInMapBounds(p)) : []

  // Grid mode (single category selected, no map)
  const totalPages       = Math.ceil(displayProviders.length / ITEMS_PER_PAGE)
  const paginatedProviders = displayProviders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const activeFilterCount = [
    filters.island !== '',
    filters.minRating > 0,
    filters.maxPrice < 1000,
    filters.sortBy !== 'rating',
  ].filter(Boolean).length

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden gap-3">

      {/* ── Header ── */}
      <div className="shrink-0 space-y-3">

        {/* Search bar + action buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search providers, services…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </div>

          <button
            onClick={() => setShowFilters(true)}
            className={`relative flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
              activeFilterCount > 0
                ? 'border-dark bg-dark text-white'
                : 'border-gray-200 bg-white text-dark hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-dark">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={() => showMap ? closeMap() : openMap()}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
              showMap
                ? 'border-dark bg-dark text-white'
                : 'border-gray-200 bg-white text-dark hover:border-gray-300'
            }`}
          >
            <MapIcon size={14} />
            {showMap ? 'Hide map' : 'Show map'}
          </button>
        </div>

        {/* Category pill row */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {['All', ...CATEGORY_ORDER].map(cat => {
            const active = cat === 'All' ? filters.category === '' : filters.category === cat
            return (
              <button
                key={cat}
                onClick={() => updateFilter('category', cat === 'All' ? '' : cat)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-dark bg-dark text-white'
                    : 'border-gray-200 bg-white text-dark hover:border-gray-300'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">

        {/* Card list — always visible */}
        <div
          className={`flex flex-col gap-8 overflow-y-auto pb-6 min-w-0 [&::-webkit-scrollbar]:hidden ${showMap ? 'w-[54%] shrink-0 pr-2' : 'flex-1 pr-1'}`}
          style={{ scrollbarWidth: 'none' }}
        >

          {context && (
            <div className="shrink-0 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs text-primary ring-1 ring-primary/10">
              Your quote details will be included when you contact a provider.
            </div>
          )}
          {error && (
            <p className="shrink-0 text-sm text-red-500">{error}</p>
          )}

          {/* ── MAP MODE: flat sorted list — in-area first, then outside ── */}
          {showMap && (
            <div className="shrink-0 space-y-3">
              {/* "X in this area" header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-dark">
                  {loading
                    ? 'Searching this area…'
                    : inBoundsProviders.length > 0
                      ? `${inBoundsProviders.length} provider${inBoundsProviders.length !== 1 ? 's' : ''} in this area`
                      : 'No providers in this area — try zooming out'}
                </p>
                {loading && <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
              </div>

              {/* In-bounds providers */}
              {inBoundsProviders.map(p => (
                <ProviderCard
                  key={p.user_id}
                  provider={p}
                  isSelected={selectedId === p.user_id}
                  onHover={setSelectedId}
                  context={context}
                />
              ))}

              {/* Divider + out-of-bounds */}
              {outBoundsProviders.length > 0 && (
                <>
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-gray-200" />
                    <p className="shrink-0 text-xs font-semibold text-muted">More providers outside this area</p>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                  {outBoundsProviders.map(p => (
                    <div key={p.user_id} className="opacity-60">
                      <ProviderCard
                        provider={p}
                        isSelected={selectedId === p.user_id}
                        onHover={setSelectedId}
                        context={context}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── NORMAL MODE: All tab — horizontal scroll rows per category ── */}
          {!showMap && !filters.category && (
            <>
              {Array.from(grouped.entries()).map(([category, providers]) => (
                <section key={category} className="shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-dark">{category}</h2>
                      <p className="text-xs text-muted mt-0.5">
                        {providers.length} provider{providers.length !== 1 ? 's' : ''} available
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => scrollRow(category, 'left')}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow"
                        aria-label={`Scroll ${category} left`}
                      >
                        <ChevronLeft size={15} className="text-dark" />
                      </button>
                      <button
                        onClick={() => scrollRow(category, 'right')}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200 hover:shadow-md transition-shadow"
                        aria-label={`Scroll ${category} right`}
                      >
                        <ChevronRight size={15} className="text-dark" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={el => { rowRefs.current[category] = el }}
                    className="flex gap-4 overflow-x-auto pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {providers.map(p => (
                      <AirbnbProviderCard
                        key={p.user_id}
                        provider={p}
                        isSelected={selectedId === p.user_id}
                        onHover={setSelectedId}
                        context={context}
                        photoUrl={portfolioThumbs[p.user_id]}
                      />
                    ))}
                  </div>

                  <div className="border-b border-gray-100 pt-2" />
                </section>
              ))}

              {grouped.size === 0 && !loading && (
                <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-sm text-muted">No providers found. Try adjusting your filters.</p>
                </div>
              )}
            </>
          )}

          {/* ── NORMAL MODE: Single category — grid + pagination ── */}
          {!showMap && filters.category && (
            <div className="shrink-0 space-y-5">
              <div>
                <h2 className="text-base font-bold text-dark">{filters.category}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {displayProviders.length} provider{displayProviders.length !== 1 ? 's' : ''} available
                </p>
              </div>

              {paginatedProviders.length > 0 ? (
                <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedProviders.map(p => (
                    <AirbnbProviderCard
                      key={p.user_id}
                      provider={p}
                      isSelected={selectedId === p.user_id}
                      onHover={setSelectedId}
                      context={context}
                      fill
                      photoUrl={portfolioThumbs[p.user_id]}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-sm text-muted">No providers found. Try adjusting your filters.</p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-dark hover:border-gray-300 disabled:opacity-30 disabled:cursor-default transition"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition ${
                        page === currentPage
                          ? 'bg-dark text-white border border-dark'
                          : 'border border-gray-200 bg-white text-dark hover:border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-dark hover:border-gray-300 disabled:opacity-30 disabled:cursor-default transition"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map panel — slides in alongside list */}
        {showMap && (
          <div className="relative flex-1 overflow-hidden rounded-2xl">
            <ProviderMap
              providers={displayProviders}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onBoundsChange={handleBoundsChange}
            />
            <button
              onClick={closeMap}
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-dark shadow-md hover:shadow-lg transition-shadow"
            >
              <X size={12} /> Hide map
            </button>
          </div>
        )}
      </div>

      {/* Filters modal */}
      {showFilters && (
        <FiltersModal
          filters={filters}
          onChange={updateFilter}
          providerCount={providerCount}
          locationGranted={geoGranted}
          onRequestLocation={handleRequestLocation}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}
