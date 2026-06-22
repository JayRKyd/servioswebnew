'use client'
import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useProviderSearch } from '@/hooks/useProviderSearch'
import { useGeolocation } from '@/hooks/useGeolocation'
import { ProviderFilters } from '@/components/search/ProviderFilters'
import { AirbnbProviderCard } from '@/components/search/ProviderCard'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProviderHit } from '@/hooks/useProviderSearch'

const ProviderMap = dynamic(
  () => import('@/components/search/ProviderMap').then((m) => m.ProviderMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-xl bg-gray-100" /> }
)

// ─── Mock providers — 4 per category ──────────────────────────────────────────
const MOCK_PROVIDERS: ProviderHit[] = [
  // Plumbing
  { objectID: 'p1', user_id: 'p1', first_name: 'James',   last_name: 'Taylor',   business_name: '',               bio: 'Experienced plumber. 12+ years residential & commercial.',   islands: ['Central London'], hourly_rate: 75, rating_average: 4.9, rating_count: 28, categories: ['Plumbing'],   avatar_url: null },
  { objectID: 'p2', user_id: 'p2', first_name: 'Ryan',    last_name: 'Hughes',   business_name: 'Hughes Plumbing',bio: 'Specialist in boiler installs and bathroom refits.',          islands: ['North London'],   hourly_rate: 65, rating_average: 4.7, rating_count: 16, categories: ['Plumbing'],   avatar_url: null },
  { objectID: 'p3', user_id: 'p3', first_name: 'Tom',     last_name: 'Patel',    business_name: '',               bio: 'Emergency plumber available 7 days. No call-out charge.',    islands: ['South London'],   hourly_rate: 80, rating_average: 4.8, rating_count: 33, categories: ['Plumbing'],   avatar_url: null },
  { objectID: 'p4', user_id: 'p4', first_name: 'Sarah',   last_name: 'Evans',    business_name: '',               bio: 'Domestic plumbing and drainage specialist.',                 islands: ['East London'],    hourly_rate: 70, rating_average: 4.5, rating_count: 8,  categories: ['Plumbing'],   avatar_url: null },
  // Electrical
  { objectID: 'e1', user_id: 'e1', first_name: 'Mike',    last_name: 'Chen',     business_name: 'Chen Electrics', bio: 'Fully qualified. NICEIC approved contractor.',               islands: ['South London'],   hourly_rate: 85, rating_average: 5.0, rating_count: 41, categories: ['Electrical'], avatar_url: null },
  { objectID: 'e2', user_id: 'e2', first_name: 'David',   last_name: 'Wright',   business_name: '',               bio: 'EV charger installation and smart home wiring expert.',      islands: ['West London'],    hourly_rate: 75, rating_average: 4.6, rating_count: 19, categories: ['Electrical'], avatar_url: null },
  { objectID: 'e3', user_id: 'e3', first_name: 'Anna',    last_name: 'Simmons',  business_name: 'Simmons Electric',bio: 'Commercial and domestic electrical. 18th Edition certified.',islands: ['Central London'], hourly_rate: 90, rating_average: 4.8, rating_count: 27, categories: ['Electrical'], avatar_url: null },
  { objectID: 'e4', user_id: 'e4', first_name: 'Ben',     last_name: 'Murphy',   business_name: '',               bio: 'Fuse board upgrades and rewiring specialists.',              islands: ['North London'],   hourly_rate: 70, rating_average: 4.4, rating_count: 11, categories: ['Electrical'], avatar_url: null },
  // Cleaning
  { objectID: 'c1', user_id: 'c1', first_name: 'Sarah',   last_name: 'Mitchell', business_name: 'CleanPro Ltd',   bio: 'Professional deep-cleaning and end-of-tenancy specialists.', islands: ['North London'],   hourly_rate: 38, rating_average: 4.7, rating_count: 14, categories: ['Cleaning'],   avatar_url: null },
  { objectID: 'c2', user_id: 'c2', first_name: 'Maria',   last_name: 'Costa',    business_name: '',               bio: '5-star rated domestic cleaner. Weekly and one-off bookings.', islands: ['Central London'], hourly_rate: 35, rating_average: 4.9, rating_count: 52, categories: ['Cleaning'],   avatar_url: null },
  { objectID: 'c3', user_id: 'c3', first_name: 'Emily',   last_name: 'Park',     business_name: 'Sparkle Clean',  bio: 'Office and commercial cleaning. Flexible scheduling.',        islands: ['East London'],    hourly_rate: 40, rating_average: 4.6, rating_count: 23, categories: ['Cleaning'],   avatar_url: null },
  { objectID: 'c4', user_id: 'c4', first_name: 'Jake',    last_name: 'Williams', business_name: '',               bio: 'Carpet and upholstery deep clean specialist.',               islands: ['South London'],   hourly_rate: 32, rating_average: 4.3, rating_count: 7,  categories: ['Cleaning'],   avatar_url: null },
  // Painting
  { objectID: 'pa1', user_id: 'pa1', first_name: 'Emma',   last_name: 'Clarke',   business_name: '',               bio: 'Interior and exterior painting. Neat and reliable.',         islands: ['East London'],    hourly_rate: 50, rating_average: 4.6, rating_count: 9,  categories: ['Painting'],   avatar_url: null },
  { objectID: 'pa2', user_id: 'pa2', first_name: 'Carlos', last_name: 'Mendez',   business_name: 'CM Decorators',  bio: 'Decorating specialists. Feature walls and wallpaper.',       islands: ['North London'],   hourly_rate: 55, rating_average: 4.8, rating_count: 31, categories: ['Painting'],   avatar_url: null },
  { objectID: 'pa3', user_id: 'pa3', first_name: 'Lucy',   last_name: 'Thompson', business_name: '',               bio: 'Fine brush work and colour consultations included.',         islands: ['West London'],    hourly_rate: 45, rating_average: 4.5, rating_count: 12, categories: ['Painting'],   avatar_url: null },
  { objectID: 'pa4', user_id: 'pa4', first_name: 'Oliver', last_name: 'Nash',     business_name: 'Nash & Co',      bio: 'Commercial painter. Large-scale projects welcome.',          islands: ['Central London'], hourly_rate: 60, rating_average: 4.7, rating_count: 18, categories: ['Painting'],   avatar_url: null },
  // HVAC
  { objectID: 'h1', user_id: 'h1', first_name: 'David',   last_name: 'Brown',    business_name: 'Brown HVAC',     bio: 'Heating, ventilation and AC installation & servicing.',     islands: ['West London'],    hourly_rate: 90, rating_average: 4.8, rating_count: 22, categories: ['HVAC'],       avatar_url: null },
  { objectID: 'h2', user_id: 'h2', first_name: 'Sophie',  last_name: 'Lee',      business_name: '',               bio: 'Gas Safe registered. Boiler service and repair.',           islands: ['South London'],   hourly_rate: 85, rating_average: 4.9, rating_count: 35, categories: ['HVAC'],       avatar_url: null },
  { objectID: 'h3', user_id: 'h3', first_name: 'Mark',    last_name: 'Stevens',  business_name: 'Stevens Climate', bio: 'Air conditioning units — supply, fit, and maintain.',       islands: ['Central London'], hourly_rate: 95, rating_average: 4.6, rating_count: 14, categories: ['HVAC'],       avatar_url: null },
  { objectID: 'h4', user_id: 'h4', first_name: 'Hannah',  last_name: 'Davis',    business_name: '',               bio: 'Underfloor heating and smart thermostat specialist.',        islands: ['North London'],   hourly_rate: 80, rating_average: 4.5, rating_count: 9,  categories: ['HVAC'],       avatar_url: null },
]

const CATEGORY_ORDER = ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'HVAC']

type ViewMode = 'list' | 'map' | 'split'

export default function SearchPage() {
  return <Suspense fallback={null}><SearchPageInner /></Suspense>
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const { query, setQuery, filters, updateFilter, setMapBounds, results, total, loading, error } = useProviderSearch()
  const { location, granted: geoGranted, requestLocation } = useGeolocation()
  const [viewMode, setViewMode]   = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const categoryParam = searchParams.get('category')
  const context       = searchParams.get('context') ?? ''

  useEffect(() => {
    if (categoryParam) updateFilter('category', categoryParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam])

  useEffect(() => {
    if (location) {
      setMapBounds(location.lat, location.lng, 50_000)
      updateFilter('sortBy', 'distance')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const handleRequestLocation = useCallback(() => requestLocation(), [requestLocation])
  const handleBoundsChange    = useCallback((lat: number, lng: number, radius: number) => setMapBounds(lat, lng, radius), [setMapBounds])

  function scrollRow(cat: string, dir: 'left' | 'right') {
    rowRefs.current[cat]?.scrollBy({ left: dir === 'right' ? 536 : -536, behavior: 'smooth' })
  }

  // Use real results if available, otherwise fall back to mock data
  const displayProviders: ProviderHit[] = useMemo(() => {
    if (results.length > 0) return results
    if (filters.category) {
      return MOCK_PROVIDERS.filter(p =>
        p.categories[0]?.toLowerCase() === filters.category.toLowerCase()
      )
    }
    return MOCK_PROVIDERS
  }, [results, filters.category])

  // Group by category, preserving CATEGORY_ORDER for "All" view
  const grouped = useMemo(() => {
    const map = new Map<string, ProviderHit[]>()
    // seed in preferred order first
    const orderedCats = filters.category
      ? [filters.category]
      : CATEGORY_ORDER
    for (const cat of orderedCats) map.set(cat, [])
    for (const p of displayProviders) {
      const cat = p.categories[0] ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    // remove empty categories
    for (const [k, v] of map.entries()) { if (v.length === 0) map.delete(k) }
    return map
  }, [displayProviders, filters.category])

  const usingMock = results.length === 0

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-hidden">

      {/* ── Search bar + view toggle ── */}
      <div className="flex items-center gap-3 shrink-0">
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
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shrink-0">
          {(['list', 'split', 'map'] as ViewMode[]).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={'px-3 py-2 text-xs font-medium capitalize transition ' + (viewMode === mode ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50')}>
              {mode === 'list' ? '☰ List' : mode === 'split' ? '⊟ Split' : '🗺 Map'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">

        {/* Filters sidebar */}
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

        {/* ── List panel ── */}
        {(viewMode === 'list' || viewMode === 'split') && (
          <div className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto pr-1 pb-6">

            {/* Context / mock banner */}
            {context && (
              <div className="shrink-0 flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs text-primary ring-1 ring-primary/10">
                <span>🎯</span>
                <span>Showing providers matched to your job details.</span>
              </div>
            )}
            {usingMock && !context && (
              <div className="shrink-0 flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-xs text-muted ring-1 ring-gray-100">
                <span>✨</span>
                <span>Showing featured providers — connect your search index to see live results.</span>
              </div>
            )}

            {error && !usingMock && (
              <p className="shrink-0 text-sm text-red-500">{error}</p>
            )}

            {/* ── One row per category ── */}
            {Array.from(grouped.entries()).map(([category, providers]) => (
              <section key={category} className="shrink-0 space-y-3">

                {/* Section header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-dark">{category}</h2>
                    <p className="text-xs text-muted mt-0.5">{providers.length} provider{providers.length !== 1 ? 's' : ''} available</p>
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

                {/* Horizontal card row */}
                <div
                  ref={el => { rowRefs.current[category] = el }}
                  className="flex gap-4 overflow-x-auto pb-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {providers.map((p) => (
                    <AirbnbProviderCard
                      key={p.user_id}
                      provider={p}
                      isSelected={selectedId === p.user_id}
                      onHover={setSelectedId}
                      context={context}
                    />
                  ))}
                </div>

                {/* Divider between categories */}
                <div className="border-b border-gray-100 pt-2" />
              </section>
            ))}

            {grouped.size === 0 && !loading && (
              <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-sm text-muted">No providers found. Try adjusting your filters.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Map panel ── */}
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
