'use client'
import { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useProviderSearch } from '@/hooks/useProviderSearch'
import { useGeolocation } from '@/hooks/useGeolocation'
import { AirbnbProviderCard } from '@/components/search/ProviderCard'
import {
  ChevronLeft, ChevronRight, Search, SlidersHorizontal, Map as MapIcon, X, MapPin,
} from 'lucide-react'
import type { ProviderHit, SearchFilters } from '@/hooks/useProviderSearch'

const ProviderMap = dynamic(
  () => import('@/components/search/ProviderMap').then((m) => m.ProviderMap),
  { ssr: false, loading: () => <div className="h-full w-full rounded-2xl bg-gray-100" /> }
)

// ─── Mock providers — 8 per category, with London _geoloc for map ─────────────
// Coords are approximate per-area with slight scatter so markers don't overlap
const MOCK_PROVIDERS: ProviderHit[] = [
  // Plumbing
  { objectID: 'p1', user_id: 'p1', first_name: 'James',   last_name: 'Taylor',   business_name: '',                bio: 'Experienced plumber. 12+ years residential & commercial.',    islands: ['Central London'], hourly_rate: 75, rating_average: 4.9, rating_count: 28, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5074, lng: -0.1278 } },
  { objectID: 'p2', user_id: 'p2', first_name: 'Ryan',    last_name: 'Hughes',   business_name: 'Hughes Plumbing', bio: 'Specialist in boiler installs and bathroom refits.',           islands: ['North London'],   hourly_rate: 65, rating_average: 4.7, rating_count: 16, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5510, lng: -0.1050 } },
  { objectID: 'p3', user_id: 'p3', first_name: 'Tom',     last_name: 'Patel',    business_name: '',                bio: 'Emergency plumber available 7 days. No call-out charge.',     islands: ['South London'],   hourly_rate: 80, rating_average: 4.8, rating_count: 33, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.4615, lng: -0.1160 } },
  { objectID: 'p4', user_id: 'p4', first_name: 'Sarah',   last_name: 'Evans',    business_name: '',                bio: 'Domestic plumbing and drainage specialist.',                  islands: ['East London'],    hourly_rate: 70, rating_average: 4.5, rating_count: 8,  categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5194, lng: -0.0554 } },
  { objectID: 'p5', user_id: 'p5', first_name: 'Marcus',  last_name: 'Webb',     business_name: 'Webb & Sons',     bio: 'Full bathroom fit-outs and wet room conversions.',            islands: ['West London'],    hourly_rate: 85, rating_average: 4.8, rating_count: 20, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5095, lng: -0.2340 } },
  { objectID: 'p6', user_id: 'p6', first_name: 'Lisa',    last_name: 'Thornton', business_name: '',                bio: 'Reliable same-day plumber. Leaks, taps, and radiators.',      islands: ['North London'],   hourly_rate: 60, rating_average: 4.6, rating_count: 11, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5480, lng: -0.0920 } },
  { objectID: 'p7', user_id: 'p7', first_name: 'Danny',   last_name: 'Okafor',   business_name: 'Okafor Plumbing', bio: 'Commercial plumbing contracts and planned maintenance.',       islands: ['Central London'], hourly_rate: 72, rating_average: 4.7, rating_count: 24, categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.5130, lng: -0.1100 } },
  { objectID: 'p8', user_id: 'p8', first_name: 'Priya',   last_name: 'Shah',     business_name: '',                bio: 'Water softeners, filter systems, and pressure problems.',     islands: ['South London'],   hourly_rate: 68, rating_average: 4.5, rating_count: 6,  categories: ['Plumbing'],   avatar_url: null, _geoloc: { lat: 51.4680, lng: -0.1220 } },
  // Electrical
  { objectID: 'e1', user_id: 'e1', first_name: 'Mike',    last_name: 'Chen',     business_name: 'Chen Electrics',  bio: 'Fully qualified. NICEIC approved contractor.',                islands: ['South London'],   hourly_rate: 85, rating_average: 5.0, rating_count: 41, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.4640, lng: -0.1080 } },
  { objectID: 'e2', user_id: 'e2', first_name: 'David',   last_name: 'Wright',   business_name: '',                bio: 'EV charger installation and smart home wiring expert.',       islands: ['West London'],    hourly_rate: 75, rating_average: 4.6, rating_count: 19, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5060, lng: -0.2200 } },
  { objectID: 'e3', user_id: 'e3', first_name: 'Anna',    last_name: 'Simmons',  business_name: 'Simmons Electric',bio: 'Commercial and domestic electrical. 18th Edition certified.', islands: ['Central London'], hourly_rate: 90, rating_average: 4.8, rating_count: 27, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5000, lng: -0.1350 } },
  { objectID: 'e4', user_id: 'e4', first_name: 'Ben',     last_name: 'Murphy',   business_name: '',                bio: 'Fuse board upgrades and rewiring specialists.',               islands: ['North London'],   hourly_rate: 70, rating_average: 4.4, rating_count: 11, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5600, lng: -0.0850 } },
  { objectID: 'e5', user_id: 'e5', first_name: 'Sam',     last_name: 'Bridges',  business_name: 'Bridges Electrical',bio: 'PAT testing, periodic inspections, and full rewires.',      islands: ['East London'],    hourly_rate: 80, rating_average: 4.7, rating_count: 18, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5280, lng: -0.0400 } },
  { objectID: 'e6', user_id: 'e6', first_name: 'Jade',    last_name: 'Osei',     business_name: '',                bio: 'Solar panel installation and battery storage systems.',       islands: ['South London'],   hourly_rate: 95, rating_average: 4.9, rating_count: 30, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.4550, lng: -0.0980 } },
  { objectID: 'e7', user_id: 'e7', first_name: 'Connor',  last_name: 'Walsh',    business_name: '',                bio: 'Smart lighting, CCTV, and alarm installations.',             islands: ['West London'],    hourly_rate: 78, rating_average: 4.5, rating_count: 9,  categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5150, lng: -0.2480 } },
  { objectID: 'e8', user_id: 'e8', first_name: 'Aisha',   last_name: 'Malik',    business_name: 'Malik Electrics', bio: 'Landlord certificates and emergency fault finding.',          islands: ['North London'],   hourly_rate: 72, rating_average: 4.6, rating_count: 15, categories: ['Electrical'], avatar_url: null, _geoloc: { lat: 51.5440, lng: -0.1150 } },
  // Cleaning
  { objectID: 'c1', user_id: 'c1', first_name: 'Sarah',   last_name: 'Mitchell', business_name: 'CleanPro Ltd',    bio: 'Professional deep-cleaning and end-of-tenancy specialists.',  islands: ['North London'],   hourly_rate: 38, rating_average: 4.7, rating_count: 14, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5520, lng: -0.1200 } },
  { objectID: 'c2', user_id: 'c2', first_name: 'Maria',   last_name: 'Costa',    business_name: '',                bio: '5-star rated domestic cleaner. Weekly and one-off bookings.',  islands: ['Central London'], hourly_rate: 35, rating_average: 4.9, rating_count: 52, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5050, lng: -0.0900 } },
  { objectID: 'c3', user_id: 'c3', first_name: 'Emily',   last_name: 'Park',     business_name: 'Sparkle Clean',   bio: 'Office and commercial cleaning. Flexible scheduling.',         islands: ['East London'],    hourly_rate: 40, rating_average: 4.6, rating_count: 23, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5100, lng: -0.0650 } },
  { objectID: 'c4', user_id: 'c4', first_name: 'Jake',    last_name: 'Williams', business_name: '',                bio: 'Carpet and upholstery deep clean specialist.',                islands: ['South London'],   hourly_rate: 32, rating_average: 4.3, rating_count: 7,  categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.4720, lng: -0.1350 } },
  { objectID: 'c5', user_id: 'c5', first_name: 'Oliver',  last_name: 'Grant',    business_name: 'Grant Cleaning',  bio: 'Post-construction and builders clean. Fully insured.',         islands: ['West London'],    hourly_rate: 45, rating_average: 4.8, rating_count: 19, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5030, lng: -0.2600 } },
  { objectID: 'c6', user_id: 'c6', first_name: 'Fatima',  last_name: 'Al-Hassan',business_name: '',                bio: 'Eco-friendly products. Regular domestic cleans from £30.',    islands: ['North London'],   hourly_rate: 30, rating_average: 4.7, rating_count: 38, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5580, lng: -0.0780 } },
  { objectID: 'c7', user_id: 'c7', first_name: 'Ben',     last_name: 'Carter',   business_name: 'Carter & Co',    bio: 'Move-in / move-out cleans with full checklists provided.',    islands: ['Central London'], hourly_rate: 42, rating_average: 4.5, rating_count: 10, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.5110, lng: -0.1420 } },
  { objectID: 'c8', user_id: 'c8', first_name: 'Zara',    last_name: 'Singh',    business_name: '',                bio: 'Holiday let turnarounds and Airbnb cleaning specialist.',     islands: ['South London'],   hourly_rate: 36, rating_average: 4.6, rating_count: 17, categories: ['Cleaning'],   avatar_url: null, _geoloc: { lat: 51.4580, lng: -0.1290 } },
  // Painting
  { objectID: 'pa1', user_id: 'pa1', first_name: 'Emma',   last_name: 'Clarke',   business_name: '',               bio: 'Interior and exterior painting. Neat and reliable.',          islands: ['East London'],    hourly_rate: 50, rating_average: 4.6, rating_count: 9,  categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5240, lng: -0.0480 } },
  { objectID: 'pa2', user_id: 'pa2', first_name: 'Carlos', last_name: 'Mendez',   business_name: 'CM Decorators',  bio: 'Decorating specialists. Feature walls and wallpaper.',        islands: ['North London'],   hourly_rate: 55, rating_average: 4.8, rating_count: 31, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5460, lng: -0.1300 } },
  { objectID: 'pa3', user_id: 'pa3', first_name: 'Lucy',   last_name: 'Thompson', business_name: '',               bio: 'Fine brush work and colour consultations included.',          islands: ['West London'],    hourly_rate: 45, rating_average: 4.5, rating_count: 12, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5080, lng: -0.2100 } },
  { objectID: 'pa4', user_id: 'pa4', first_name: 'Oliver', last_name: 'Nash',     business_name: 'Nash & Co',      bio: 'Commercial painter. Large-scale projects welcome.',           islands: ['Central London'], hourly_rate: 60, rating_average: 4.7, rating_count: 18, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5020, lng: -0.1200 } },
  { objectID: 'pa5', user_id: 'pa5', first_name: 'Harry',  last_name: 'Nguyen',   business_name: '',               bio: 'Spray finishing and lacquer specialist. Furniture too.',      islands: ['South London'],   hourly_rate: 58, rating_average: 4.9, rating_count: 22, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.4650, lng: -0.1050 } },
  { objectID: 'pa6', user_id: 'pa6', first_name: 'Elena',  last_name: 'Vasquez',  business_name: 'Vasquez Decor',  bio: 'Bespoke murals, faux finishes, and period property work.',    islands: ['East London'],    hourly_rate: 65, rating_average: 4.7, rating_count: 14, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5160, lng: -0.0720 } },
  { objectID: 'pa7', user_id: 'pa7', first_name: 'Felix',  last_name: 'Morton',   business_name: '',               bio: 'Fast turnaround exterior masonry and render painting.',       islands: ['North London'],   hourly_rate: 48, rating_average: 4.4, rating_count: 8,  categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5540, lng: -0.0680 } },
  { objectID: 'pa8', user_id: 'pa8', first_name: 'Nadia',  last_name: 'Khan',     business_name: 'Khan Interiors', bio: 'Colour consulting and full room makeovers. Free quotes.',     islands: ['West London'],    hourly_rate: 52, rating_average: 4.6, rating_count: 16, categories: ['Painting'],   avatar_url: null, _geoloc: { lat: 51.5040, lng: -0.2440 } },
  // HVAC
  { objectID: 'h1', user_id: 'h1', first_name: 'David',   last_name: 'Brown',    business_name: 'Brown HVAC',      bio: 'Heating, ventilation and AC installation & servicing.',      islands: ['West London'],    hourly_rate: 90, rating_average: 4.8, rating_count: 22, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.5120, lng: -0.2560 } },
  { objectID: 'h2', user_id: 'h2', first_name: 'Sophie',  last_name: 'Lee',      business_name: '',                bio: 'Gas Safe registered. Boiler service and repair.',            islands: ['South London'],   hourly_rate: 85, rating_average: 4.9, rating_count: 35, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.4700, lng: -0.1020 } },
  { objectID: 'h3', user_id: 'h3', first_name: 'Mark',    last_name: 'Stevens',  business_name: 'Stevens Climate', bio: 'Air conditioning units — supply, fit, and maintain.',        islands: ['Central London'], hourly_rate: 95, rating_average: 4.6, rating_count: 14, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.5090, lng: -0.0980 } },
  { objectID: 'h4', user_id: 'h4', first_name: 'Hannah',  last_name: 'Davis',    business_name: '',                bio: 'Underfloor heating and smart thermostat specialist.',         islands: ['North London'],   hourly_rate: 80, rating_average: 4.5, rating_count: 9,  categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.5620, lng: -0.1140 } },
  { objectID: 'h5', user_id: 'h5', first_name: 'James',   last_name: "O'Brien",  business_name: "O'Brien Climate", bio: 'Commercial HVAC contracts. Preventive maintenance plans.',    islands: ['East London'],    hourly_rate: 100, rating_average: 4.8, rating_count: 17, categories: ['HVAC'],      avatar_url: null, _geoloc: { lat: 51.5300, lng: -0.0320 } },
  { objectID: 'h6', user_id: 'h6', first_name: 'Amy',     last_name: 'Chen',     business_name: '',                bio: 'Heat pump installs and renewable energy heating systems.',   islands: ['West London'],    hourly_rate: 92, rating_average: 4.9, rating_count: 28, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.5070, lng: -0.2700 } },
  { objectID: 'h7', user_id: 'h7', first_name: 'Ryan',    last_name: 'Okafor',   business_name: 'Okafor HVAC',     bio: 'Emergency call-out for boiler breakdowns and gas leaks.',    islands: ['South London'],   hourly_rate: 88, rating_average: 4.7, rating_count: 13, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.4530, lng: -0.1400 } },
  { objectID: 'h8', user_id: 'h8', first_name: 'Charlotte',last_name: 'King',    business_name: '',                bio: 'Domestic boiler servicing and annual safety certificates.',   islands: ['Central London'], hourly_rate: 78, rating_average: 4.5, rating_count: 11, categories: ['HVAC'],       avatar_url: null, _geoloc: { lat: 51.5170, lng: -0.0820 } },
]

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
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const ITEMS_PER_PAGE = 6

  const categoryParam = searchParams.get('category')
  const context       = searchParams.get('context') ?? ''

  useEffect(() => {
    if (categoryParam) updateFilter('category', categoryParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam])

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
    (ne: { lat: number; lng: number }, sw: { lat: number; lng: number }) => setMapViewport(ne, sw),
    [setMapViewport]
  )

  function openMap()  { setShowMap(true) }
  function closeMap() { setShowMap(false); clearMapViewport() }

  function scrollRow(cat: string, dir: 'left' | 'right') {
    rowRefs.current[cat]?.scrollBy({ left: dir === 'right' ? 536 : -536, behavior: 'smooth' })
  }

  const displayProviders: ProviderHit[] = useMemo(() => {
    if (results.length > 0) return results
    if (filters.category) {
      return MOCK_PROVIDERS.filter(p =>
        p.categories[0]?.toLowerCase() === filters.category.toLowerCase()
      )
    }
    return MOCK_PROVIDERS
  }, [results, filters.category])

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

  const usingMock = results.length === 0
  const providerCount = total > 0 ? total : displayProviders.length

  // Grid mode (single category selected)
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

          {showMap && (
            <div className="shrink-0 rounded-xl bg-white border border-gray-100 px-4 py-2.5 flex items-center justify-between shadow-sm">
              <p className="text-sm font-semibold text-dark">
                {loading
                  ? 'Searching this area…'
                  : `${displayProviders.length} provider${displayProviders.length !== 1 ? 's' : ''} in this area`}
              </p>
              {loading && <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
            </div>
          )}
          {context && (
            <div className="shrink-0 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs text-primary ring-1 ring-primary/10">
              Showing providers matched to your job details.
            </div>
          )}
          {usingMock && !context && !showMap && (
            <div className="shrink-0 rounded-xl bg-surface px-4 py-2.5 text-xs text-muted ring-1 ring-gray-100">
              Showing featured providers — connect your search index to see live results.
            </div>
          )}
          {error && !usingMock && (
            <p className="shrink-0 text-sm text-red-500">{error}</p>
          )}

          {/* ── All tab: horizontal scroll rows per category ── */}
          {!filters.category && (
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

          {/* ── Single category: grid + pagination ── */}
          {filters.category && (
            <div className="shrink-0 space-y-5">
              {/* Header */}
              <div>
                <h2 className="text-base font-bold text-dark">{filters.category}</h2>
                <p className="text-xs text-muted mt-0.5">
                  {displayProviders.length} provider{displayProviders.length !== 1 ? 's' : ''} available
                </p>
              </div>

              {/* Grid */}
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
