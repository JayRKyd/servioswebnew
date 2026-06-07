import Link from 'next/link'
import { MapPin, CheckCircle } from 'lucide-react'
import type { ProviderHit } from '@/hooks/useProviderSearch'
import { BADGE_LABELS } from '@/lib/document-requirements'

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span className="flex items-center gap-px">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className={`text-sm leading-none ${n <= full ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
      ))}
    </span>
  )
}

export function ProviderCard({
  provider,
  isSelected,
  onHover,
  context,
}: {
  provider: ProviderHit
  isSelected?: boolean
  onHover?: (id: string | null) => void
  context?: string
}) {
  const displayName = provider.business_name || `${provider.first_name} ${provider.last_name}`
  const href = `/providers/${provider.user_id}` + (context ? `?context=${encodeURIComponent(context)}` : '')
  const isVerified = provider.is_verified !== false
  const badges = provider.verified_badges ?? []
  const distance = provider._rankingInfo?.geoDistance

  return (
    <Link
      href={href}
      onMouseEnter={() => onHover?.(provider.user_id)}
      onMouseLeave={() => onHover?.(null)}
      className={
        'group block rounded-2xl bg-white p-5 shadow-sm transition-all ' +
        (isSelected
          ? 'ring-2 ring-primary shadow-md shadow-blue-100/60'
          : 'ring-1 ring-gray-100 hover:ring-2 hover:ring-primary/30 hover:shadow-md')
      }
    >
      <div className="flex items-start gap-4">

        {/* Avatar with verified badge overlay */}
        <div className="relative shrink-0">
          <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl ring-2 ring-white">
            {provider.avatar_url
              ? <img src={provider.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              : displayName.charAt(0).toUpperCase()}
          </div>
          {isVerified && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
              <CheckCircle size={12} className="text-white" strokeWidth={2.5} />
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">

          {/* Name + verified chip */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900 leading-tight truncate">{displayName}</p>
            {isVerified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">
                ✓ Verified
              </span>
            )}
          </div>

          {/* Verified document badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {badges.slice(0, 3).map(badge => (
                <span key={badge} className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                  ✓ {BADGE_LABELS[badge] ?? badge}
                </span>
              ))}
            </div>
          )}

          {/* Stars + stats row */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <Stars rating={provider.rating_average ?? 0} />
            <span className="text-xs font-semibold text-gray-800">{provider.rating_average?.toFixed(1) ?? '—'}</span>
            <span className="text-xs text-gray-400">· {provider.rating_count ?? 0} reviews</span>
            {(provider.jobs_completed ?? 0) > 0 && (
              <span className="text-xs text-gray-400">· {provider.jobs_completed} jobs</span>
            )}
          </div>

          {/* Bio */}
          {provider.bio && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{provider.bio}</p>
          )}

          {/* Category tags */}
          {provider.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {provider.categories.slice(0, 4).map((c) => (
                <span key={c} className="rounded-full bg-primary/[0.06] px-2 py-0.5 text-[11px] font-medium text-primary">
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Footer: location + CTA */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
              {provider.areas?.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={11} />
                  {provider.areas[0]}
                </span>
              )}
              {distance != null && distance > 0 && (
                <span>{(distance / 1000).toFixed(1)} km away</span>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors group-hover:bg-primary-dark">
              View profile →
            </span>
          </div>
        </div>

        {/* Rate column */}
        {provider.hourly_rate > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-gray-900">
              £{provider.hourly_rate}
              <span className="text-xs font-normal text-gray-400">/hr</span>
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}
