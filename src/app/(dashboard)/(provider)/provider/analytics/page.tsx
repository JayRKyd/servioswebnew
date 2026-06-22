'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatCurrency } from '@/lib/utils'
import { Briefcase, CheckCircle, TrendingUp, PoundSterling, Star, MessageSquare } from 'lucide-react'

const BAR_H = 80 // max bar height in px

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BarGroup({
  title,
  bars,
  format,
}: {
  title: string
  bars: { label: string; key: string; val: number; isCurrent: boolean }[]
  format: (v: number) => string
}) {
  const max = Math.max(...bars.map(b => b.val), 1)
  return (
    <div className="flex-1 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <p className="mb-5 text-sm font-semibold text-gray-900">{title}</p>

      {/* Value labels */}
      <div className="flex gap-3 mb-1">
        {bars.map(b => (
          <div key={b.key} className="flex-1 text-center">
            <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
              {b.val > 0 ? format(b.val) : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-3" style={{ height: `${BAR_H}px` }}>
        {bars.map(b => {
          const h = b.val > 0 ? Math.max(Math.round((b.val / max) * BAR_H), 6) : 3
          return (
            <div
              key={b.key}
              className="group relative flex flex-1 items-end justify-center"
              style={{ height: `${BAR_H}px` }}
            >
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${
                  b.isCurrent ? 'bg-primary' : 'bg-primary/20 group-hover:bg-primary/40'
                } ${b.val === 0 ? 'opacity-20' : ''}`}
                style={{ height: `${h}px` }}
              />
            </div>
          )
        })}
      </div>

      {/* Month labels */}
      <div className="flex gap-3 mt-2">
        {bars.map(b => (
          <div key={b.key} className="flex-1 text-center">
            <span className={`text-xs font-semibold ${b.isCurrent ? 'text-primary' : 'text-gray-400'}`}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={14}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  )
}

export default function ProviderAnalyticsPage() {
  const { providerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<{ rating_average: number; total_reviews: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) return
    Promise.all([
      supabase.from('bookings').select('status, total_amount, base_amount, scheduled_date').eq('provider_id', providerId),
      supabase.from('provider_profiles').select('rating_average, total_reviews').eq('id', providerId).maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      setBookings(b ?? [])
      setProfile(p)
      setLoading(false)
    })
  }, [providerId])

  const now = new Date()
  const completed  = bookings.filter(x => x.status === 'completed')
  const cancelled  = bookings.filter(x => x.status === 'cancelled')
  const totalRev   = completed.reduce((s, x) => s + (x.base_amount ?? x.total_amount ?? 0), 0)
  const completion = bookings.length > 0 ? Math.round((completed.length / bookings.length) * 100) : 0
  const avgRating  = Number(profile?.rating_average ?? 0)
  const reviewCount = profile?.total_reviews ?? 0

  // Last 6 months data
  const months = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = monthKey(d)
      const label = d.toLocaleDateString('en-GB', { month: 'short' })
      const slice = completed.filter(x => monthKey(new Date(x.scheduled_date)) === key)
      return {
        key,
        label,
        isCurrent: key === monthKey(now),
        jobs: slice.length,
        revenue: slice.reduce((s, x) => s + (x.base_amount ?? x.total_amount ?? 0), 0),
      }
    })
  }, [bookings])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Bookings',
      value: bookings.length,
      display: bookings.length.toString(),
      icon: <Briefcase size={15} />,
      iconBg: 'bg-blue-50 text-blue-600',
      sub: `${cancelled.length} cancelled`,
    },
    {
      label: 'Completed',
      value: completed.length,
      display: completed.length.toString(),
      icon: <CheckCircle size={15} />,
      iconBg: 'bg-green-50 text-green-600',
      sub: `${bookings.length - completed.length - cancelled.length} in progress`,
    },
    {
      label: 'Completion Rate',
      value: completion,
      display: bookings.length > 0 ? `${completion}%` : '—',
      icon: <TrendingUp size={15} />,
      iconBg: 'bg-purple-50 text-purple-600',
      progress: bookings.length > 0 ? completion : null,
      sub: bookings.length === 0 ? 'Complete a booking to see this' : undefined,
    },
    {
      label: 'Total Revenue',
      value: totalRev,
      display: completed.length > 0 ? formatCurrency(totalRev / 100) : '—',
      icon: <PoundSterling size={15} />,
      iconBg: 'bg-emerald-50 text-emerald-600',
      sub: completed.length > 0 ? `avg ${formatCurrency(totalRev / completed.length / 100)} / job` : 'Earn from completed jobs',
    },
    {
      label: 'Avg Rating',
      value: avgRating,
      display: avgRating > 0 ? avgRating.toFixed(1) : '—',
      icon: <Star size={15} />,
      iconBg: 'bg-amber-50 text-amber-500',
      stars: avgRating > 0,
      sub: avgRating > 0 ? undefined : 'Complete a job to earn reviews',
    },
    {
      label: 'Total Reviews',
      value: reviewCount,
      display: reviewCount.toString(),
      icon: <MessageSquare size={15} />,
      iconBg: 'bg-pink-50 text-pink-600',
      sub: reviewCount > 0 ? `based on ${reviewCount} review${reviewCount !== 1 ? 's' : ''}` : 'No reviews yet',
    },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-400">Performance overview for your provider account</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{card.label}</p>
              <div className={`rounded-xl p-1.5 ${card.iconBg}`}>{card.icon}</div>
            </div>

            {card.display === '—' ? (
              <p className="text-sm font-semibold text-gray-300">Not enough data yet</p>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-gray-900">{card.display}</p>
            )}

            {'stars' in card && card.stars && (
              <div className="mt-2">
                <StarRating rating={avgRating} />
              </div>
            )}

            {'progress' in card && card.progress !== null && (
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all"
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
              </div>
            )}

            {card.sub && (
              <p className="mt-1.5 text-xs text-gray-400">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="flex gap-4">
        <BarGroup
          title="Jobs Completed — Last 6 Months"
          bars={months.map(m => ({ ...m, val: m.jobs }))}
          format={v => v.toString()}
        />
        <BarGroup
          title="Revenue — Last 6 Months"
          bars={months.map(m => ({ ...m, val: m.revenue }))}
          format={v => formatCurrency(v / 100)}
        />
      </div>

    </div>
  )
}
