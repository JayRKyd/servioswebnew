import Link from 'next/link'
import type { ProviderHit } from '@/hooks/useProviderSearch'

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
          ? 'ring-2 ring-primary shadow-blue-100'
          : 'ring-1 ring-gray-100 hover:ring-blue-200 hover:shadow-md')
      }
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative h-14 w-14 shrink-0">
          <div className="h-14 w-14 overflow-hidden rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold text-xl">
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
          <p className="text-xs text-blue-500 font-medium mt-1">View profile →</p>
        </div>
      </div>
    </Link>
  )
}
