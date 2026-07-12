'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Search } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { AirbnbProviderCard, BOOKMARKS_KEY } from '@/components/search/ProviderCard'
import { usePortfolioThumbs } from '@/hooks/usePortfolioThumbs'
import type { ProviderHit } from '@/hooks/useProviderSearch'

export default function SavedProvidersPage() {
  const [providers, setProviders] = useState<ProviderHit[]>([])
  const [loading, setLoading]     = useState(true)

  // Re-read bookmarks whenever the tab regains focus, so un-saving on another
  // page (or a card here) is reflected.
  const [savedIds, setSavedIds] = useState<string[]>([])
  useEffect(() => {
    const read = () => {
      const raw = localStorage.getItem(BOOKMARKS_KEY)
      setSavedIds(raw ? JSON.parse(raw) : [])
    }
    read()
    window.addEventListener('focus', read)
    return () => window.removeEventListener('focus', read)
  }, [])

  useEffect(() => {
    if (savedIds.length === 0) { setProviders([]); setLoading(false); return }
    setLoading(true)
    supabase
      .from('provider_profiles')
      .select('user_id, business_name, first_name, last_name, bio, trade_category, hourly_rate, rating_average, total_reviews, profile_image_url, service_areas')
      .in('user_id', savedIds)
      .then(({ data }) => {
        setProviders((data ?? []).map((p: any) => ({
          objectID:       p.user_id,
          user_id:        p.user_id,
          business_name:  p.business_name,
          first_name:     p.first_name,
          last_name:      p.last_name,
          bio:            p.bio ?? '',
          islands:        Array.isArray(p.service_areas) ? p.service_areas : [],
          hourly_rate:    p.hourly_rate ?? 0,
          rating_average: Number(p.rating_average) || 0,
          rating_count:   p.total_reviews ?? 0,
          categories:     p.trade_category ? [p.trade_category] : [],
          avatar_url:     p.profile_image_url ?? null,
        })))
        setLoading(false)
      })
  }, [savedIds])

  const thumbs = usePortfolioThumbs(providers.filter(p => !p.avatar_url).map(p => p.user_id))

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Saved providers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your shortlist — compare the providers you're considering, then message or book when you're ready.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
            <Bookmark size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No saved providers yet</p>
          <p className="max-w-xs text-xs text-gray-500 leading-relaxed">
            Tap the bookmark icon on any provider to add them to your shortlist and compare them here.
          </p>
          <Link
            href="/search"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            <Search size={14} /> Find a provider
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{providers.length} saved</p>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {providers.map(p => (
              <AirbnbProviderCard key={p.user_id} provider={p} fill photoUrl={thumbs[p.user_id]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
