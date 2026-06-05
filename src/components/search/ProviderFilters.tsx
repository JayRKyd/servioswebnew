'use client'
import { useState, useEffect } from 'react'
import type { SearchFilters } from '@/hooks/useProviderSearch'
import { PlacesAutocomplete } from './PlacesAutocomplete'
import { supabase } from '@/lib/auth'

const GROUP_LABELS: Record<string, string> = {
  trades_repairs: 'Trades & Repairs',
  property_professionals: 'Property',
  cleaning: 'Cleaning',
  automotive: 'Automotive',
  specialist: 'Specialist',
}
const GROUP_ORDER = ['trades_repairs', 'property_professionals', 'cleaning', 'automotive', 'specialist']

const SORT_OPTIONS = [
  { value: 'rating',     label: 'Top Rated' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'distance',   label: 'Nearest First' },
] as const

interface DbCategory { slug: string; name: string; group_slug: string }

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
  const [cats, setCats] = useState<DbCategory[]>([])

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('slug, name, group_slug')
      .eq('is_active', true)
      .not('group_slug', 'is', null)
      .order('display_order')
      .then(({ data }) => setCats(data ?? []))
  }, [])

  const subCats = filters.group ? cats.filter(c => c.group_slug === filters.group) : []
  const availableGroups = GROUP_ORDER.filter(g => cats.some(c => c.group_slug === g))

  function selectGroup(g: string) {
    if (filters.group === g) {
      onChange('group', '')
      onChange('category', '')
    } else {
      onChange('group', g)
      onChange('category', '')
    }
  }

  return (
    <aside className="w-full space-y-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      {/* Sort */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Sort by</label>
        <select
          value={filters.sortBy}
          onChange={e => onChange('sortBy', e.target.value as SearchFilters['sortBy'])}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Group filter */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Service group</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { onChange('group', ''); onChange('category', '') }}
            className={
              'rounded-full px-3 py-1 text-xs font-medium transition ' +
              (!filters.group ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
            }
          >
            All
          </button>
          {availableGroups.map(g => (
            <button
              key={g}
              onClick={() => selectGroup(g)}
              className={
                'rounded-full px-3 py-1 text-xs font-medium transition ' +
                (filters.group === g ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
              }
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-category filter (shown when group is selected) */}
      {subCats.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Trade</label>
          <select
            value={filters.category}
            onChange={e => onChange('category', e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All {GROUP_LABELS[filters.group!]} trades</option>
            {subCats.map(c => (
              <option key={c.slug} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Area / postcode */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Area or postcode</label>
        <PlacesAutocomplete
          value={filters.area}
          placeholder="e.g. SW1A 1AA or Manchester"
          onPlace={({ label, lat, lng }) => {
            onChange('area', label)
            onChange('aroundLat', lat)
            onChange('aroundLng', lng)
            onChange('aroundRadius', 25_000)
          }}
          onClear={() => {
            onChange('area', '')
            onChange('aroundLat', undefined)
            onChange('aroundLng', undefined)
            onChange('aroundRadius', undefined)
          }}
        />
      </div>

      {/* Min Rating */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Minimum rating: {filters.minRating > 0 ? filters.minRating.toFixed(1) + '★' : 'Any'}
        </label>
        <input
          type="range" min="0" max="5" step="0.5"
          value={filters.minRating}
          onChange={e => onChange('minRating', parseFloat(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Any</span><span>5★</span>
        </div>
      </div>

      {/* Max hourly rate */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Max rate: {filters.maxPrice < 1000 ? '£' + filters.maxPrice + '/hr' : 'Any'}
        </label>
        <input
          type="range" min="0" max="1000" step="25"
          value={filters.maxPrice}
          onChange={e => onChange('maxPrice', parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>£0</span><span>£1000+</span>
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
      {(filters.group || filters.category || filters.area || filters.minRating > 0 || filters.maxPrice < 1000) && (
        <button
          onClick={() => {
            onChange('group', '')
            onChange('category', '')
            onChange('area', '')
            onChange('aroundLat', undefined)
            onChange('aroundLng', undefined)
            onChange('aroundRadius', undefined)
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
