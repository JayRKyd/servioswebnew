'use client'
import type { SearchFilters } from '@/hooks/useProviderSearch'

const CATEGORIES = ['', 'Plumbing', 'Electrical', 'Cleaning', 'Landscaping', 'HVAC', 'Painting', 'Carpentry', 'Security', 'Roofing', 'Pest Control']
const AREAS = ['', 'Central London', 'North London', 'South London', 'East London', 'West London']
const SORT_OPTIONS = [
  { value: 'rating',     label: 'Top Rated' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance',   label: 'Nearest First' },
] as const

export function ProviderFilters({
  filters,
  onChange,
  total,
  locationGranted,
  onRequestLocation,
}: {
  filters: SearchFilters
  onChange: <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => void
  total: number
  locationGranted: boolean
  onRequestLocation: () => void
}) {
  return (
    <aside className="w-full space-y-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      {/* Sort */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort by</label>
        <select
          value={filters.sortBy}
          onChange={(e) => onChange('sortBy', e.target.value as SearchFilters['sortBy'])}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c || 'all'}
              onClick={() => onChange('category', c)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition ' +
                (filters.category === c
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
              }
            >
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Area */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Area</label>
        <select
          value={filters.island}
          onChange={(e) => onChange('island', e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {AREAS.map((i) => (
            <option key={i || 'all'} value={i}>{i || 'All Areas'}</option>
          ))}
        </select>
      </div>

      {/* Min Rating */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Minimum rating: {filters.minRating > 0 ? filters.minRating.toFixed(1) + '★' : 'Any'}
        </label>
        <input
          type="range" min="0" max="5" step="0.5"
          value={filters.minRating}
          onChange={(e) => onChange('minRating', parseFloat(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Any</span><span>5★</span>
        </div>
      </div>

      {/* Max hourly rate */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Max rate: {filters.maxPrice < 1000 ? 'USD ' + filters.maxPrice + '/hr' : 'Any'}
        </label>
        <input
          type="range" min="0" max="1000" step="25"
          value={filters.maxPrice}
          onChange={(e) => onChange('maxPrice', parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>USD 0</span><span>USD 1000+</span>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Location</label>
        {locationGranted ? (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 ring-1 ring-green-200">
            <span>📍</span>
            <span>Using your location</span>
          </div>
        ) : (
          <button
            onClick={onRequestLocation}
            className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-primary transition"
          >
            📍 Use my location
          </button>
        )}
      </div>

      {/* Clear filters */}
      {(filters.category || filters.island || filters.minRating > 0 || filters.maxPrice < 1000) && (
        <button
          onClick={() => {
            onChange('category', '')
            onChange('island', '')
            onChange('minRating', 0)
            onChange('maxPrice', 1000)
          }}
          className="w-full rounded-lg border border-gray-200 py-2 text-xs text-gray-500 hover:bg-gray-50"
        >
          Clear all filters
        </button>
      )}
    </aside>
  )
}
