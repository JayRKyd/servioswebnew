'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BadgeCheck, Star, Bookmark } from 'lucide-react'
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

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="text-yellow-400 text-sm">
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  )
}

export function ProviderCard({
  provider,
  isSelected,
  onHover,
  /** Optional: carries booking context from the wizard (e.g. category, answers) */
  context,
}: {
  provider: ProviderHit
  isSelected?: boolean
  onHover?: (id: string | null) => void
  context?: string
}) {
  const displayName = provider.business_name || `${provider.first_name} ${provider.last_name}`
  const href = `/providers/${provider.user_id}` + (context ? `?context=${encodeURIComponent(context)}` : '')

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.(provider.user_id)}
      onMouseLeave={() => onHover?.(null)}
      className={
        'block rounded-xl bg-white p-4 shadow-sm transition ' +
        (isSelected
          ? 'ring-2 ring-primary shadow-md'
          : 'ring-1 ring-gray-100 hover:ring-primary/30 hover:shadow-md')
      }
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative h-14 w-14 shrink-0">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
            {provider.avatar_url
              ? <img src={provider.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              : displayName.charAt(0).toUpperCase()}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            {/* Verified badge */}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              ✓ Verified
            </span>
          </div>

          {/* Stars + review count */}
          <div className="mt-0.5 flex items-center gap-1.5">
            <Stars rating={provider.rating_average} />
            <span className="text-xs font-medium text-gray-700">{provider.rating_average?.toFixed(1) ?? '—'}</span>
            <span className="text-xs text-gray-400">({provider.rating_count} reviews)</span>
          </div>

          {/* Service category tags */}
          {provider.categories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {provider.categories.slice(0, 3).map((c) => (
                <span key={c} className="rounded-full bg-primary/[0.06] px-2 py-0.5 text-xs font-medium text-primary">
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Bio excerpt */}
          {provider.bio && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{provider.bio}</p>
          )}
        </div>

        {/* Rate + location */}
        <div className="shrink-0 text-right space-y-1">
          {provider.hourly_rate > 0 && (
            <p className="text-sm font-bold text-primary">
              £{provider.hourly_rate}
              <span className="text-xs font-normal text-gray-400">/hr</span>
            </p>
          )}
          {provider.islands.length > 0 && (
            <p className="text-xs text-gray-400">📍 {provider.islands[0]}</p>
          )}
          {provider._rankingInfo?.geoDistance != null && provider._rankingInfo.geoDistance > 0 && (
            <p className="text-xs text-gray-400">
              {(provider._rankingInfo.geoDistance / 1000).toFixed(1)} km away
            </p>
          )}
          <p className="text-xs text-primary font-medium mt-1">View profile →</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Airbnb-style card (horizontal scroll row) ─────────────────────────────

export function AirbnbProviderCard({
  provider,
  isSelected,
  onHover,
  context,
  fill = false,
  photoUrl,
}: {
  provider: ProviderHit
  isSelected?: boolean
  onHover?: (id: string | null) => void
  context?: string
  fill?: boolean
  /** Optional portfolio photo used when the provider has no profile image */
  photoUrl?: string | null
}) {
  const displayName = provider.business_name || `${provider.first_name} ${provider.last_name}`
  const initial     = displayName.charAt(0).toUpperCase()
  const href        = `/providers/${provider.user_id}` + (context ? `?context=${encodeURIComponent(context)}` : '')
  const location    = provider.islands?.[0] ?? null
  const category    = provider.categories?.[0] ?? null
  const cardImage   = provider.avatar_url || photoUrl || null
  const { bookmarked, toggle } = useBookmark(provider.user_id)

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.(provider.user_id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group block ${fill ? 'w-full' : 'w-[248px] shrink-0'}`}
    >
      {/* Photo / avatar area */}
      <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface transition-all duration-200 ${
        isSelected ? 'ring-2 ring-primary shadow-md' : 'group-hover:shadow-md'
      }`}>
        {cardImage ? (
          <img
            src={cardImage}
            alt={displayName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 text-xl font-bold text-gray-400 shadow-sm select-none">{initial}</div>
          </div>
        )}

        {/* Verified chip */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 shadow-sm">
          <BadgeCheck size={11} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary">Verified</span>
        </div>

        {/* Bookmark button */}
        <button
          onClick={toggle}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark provider'}
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-colors hover:bg-white"
        >
          <Bookmark
            size={13}
            className={bookmarked ? 'fill-primary stroke-primary' : 'stroke-gray-500'}
          />
        </button>
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-dark truncate leading-snug">{displayName}</p>
          {provider.rating_average > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-dark">
              <Star size={11} className="fill-dark stroke-dark" />
              {provider.rating_average.toFixed(1)}
            </span>
          )}
        </div>

        {category && (
          <p className="text-xs text-muted capitalize">{category}</p>
        )}

        {location && (
          <p className="text-xs text-muted">{location}</p>
        )}

        {provider.rating_count > 0 && (
          <p className="text-xs text-muted">{provider.rating_count} review{provider.rating_count !== 1 ? 's' : ''}</p>
        )}

        {provider.hourly_rate > 0 && (
          <p className="text-sm font-semibold text-dark pt-1">
            £{provider.hourly_rate}/hr
          </p>
        )}
      </div>
    </Link>
  )
}
