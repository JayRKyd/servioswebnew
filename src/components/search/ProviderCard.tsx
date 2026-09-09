'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BadgeCheck, Star, Bookmark, MapPin } from 'lucide-react'
import type { ProviderHit } from '@/hooks/useProviderSearch'

export const BOOKMARKS_KEY = 'servios_bookmarks'

export function useBookmark(userId: string) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(BOOKMARKS_KEY)
    const list: string[] = raw ? JSON.parse(raw) : []
    setBookmarked(list.includes(userId))
  }, [userId])

  function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const raw = localStorage.getItem(BOOKMARKS_KEY)
    const list: string[] = raw ? JSON.parse(raw) : []
    const next = list.includes(userId)
      ? list.filter(id => id !== userId)
      : [...list, userId]
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next))
    setBookmarked(next.includes(userId))
  }

  return { bookmarked, toggle }
}

// ─── Dense comparison row (design item 26 — Bark/TaskRabbit style) ─────────
// The browse page's job is comparison: 4-6 of these visible at once, every
// decision signal on one line each — photo, rating, track record, real
// credentials, price.

export function ProviderRow({
  provider,
  credentials = [],
  isSelected,
  onHover,
  context,
  photoUrl,
}: {
  provider: ProviderHit
  /** Verified credential badges from provider_documents (item 25) */
  credentials?: string[]
  isSelected?: boolean
  onHover?: (id: string | null) => void
  context?: string
  /** Portfolio fallback when there's no profile photo */
  photoUrl?: string | null
}) {
  const displayName = provider.business_name || `${provider.first_name} ${provider.last_name}`
  const href = `/providers/${provider.user_id}` + (context ? `?context=${encodeURIComponent(context)}` : '')
  const thumb = provider.avatar_url || photoUrl || null
  const { bookmarked, toggle } = useBookmark(provider.user_id)

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.(provider.user_id)}
      onMouseLeave={() => onHover?.(null)}
      className={
        'flex gap-4 rounded-xl bg-white p-4 transition ' +
        (isSelected
          ? 'ring-2 ring-inset ring-primary shadow-md'
          : 'ring-1 ring-inset ring-gray-100 hover:ring-primary/30 hover:shadow-md')
      }
    >
      {/* Photo */}
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
        {thumb ? (
          <img src={thumb} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-400 select-none">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Signals */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-dark">{displayName}</p>
          {provider.rating_average > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-[13px]">
              <Star size={12} className="fill-amber-400 stroke-amber-400" />
              <span className="font-semibold text-dark">{provider.rating_average.toFixed(1)}</span>
              <span className="text-muted">({provider.rating_count})</span>
            </span>
          ) : (
            <span className="shrink-0 text-[12px] text-muted">New to Servios</span>
          )}
          {(provider.jobs_completed ?? 0) > 0 && (
            <span className="hidden sm:inline shrink-0 text-[12.5px] text-muted">
              · {provider.jobs_completed} job{provider.jobs_completed !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Real credentials — never generic */}
        {credentials.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {credentials.slice(0, 3).map(c => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/[0.07] px-2 py-0.5 text-[11px] font-medium text-primary">
                <BadgeCheck size={10} className="shrink-0" /> {c}
              </span>
            ))}
          </div>
        )}

        {provider.bio && (
          <p className="mt-1 truncate text-[12.5px] leading-relaxed text-muted">{provider.bio}</p>
        )}

        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted">
          {provider.islands.length > 0 && (
            <span className="flex items-center gap-1"><MapPin size={11} /> {provider.islands[0]}</span>
          )}
          {provider._rankingInfo?.geoDistance != null && provider._rankingInfo.geoDistance > 0 && (
            <span>· {(provider._rankingInfo.geoDistance / 1000).toFixed(1)} km away</span>
          )}
          {provider.categories[0] && <span className="hidden sm:inline">· {provider.categories[0]}</span>}
        </div>
      </div>

      {/* Price + actions */}
      <div className="flex shrink-0 flex-col items-end justify-between">
        <div className="flex items-center gap-2">
          {provider.hourly_rate > 0 && (
            <p className="text-[15px] font-bold text-dark">
              from £{provider.hourly_rate}<span className="text-xs font-normal text-muted">/hr</span>
            </p>
          )}
          <button
            onClick={toggle}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark provider'}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 transition-colors hover:bg-gray-100"
          >
            <Bookmark size={13} className={bookmarked ? 'fill-primary stroke-primary' : 'stroke-gray-500'} />
          </button>
        </div>
        <span className="rounded-lg bg-primary/[0.08] px-3 py-1.5 text-[12.5px] font-semibold text-primary">
          View profile
        </span>
      </div>
    </Link>
  )
}
