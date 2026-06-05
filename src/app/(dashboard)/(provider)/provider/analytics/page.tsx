'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatCurrency } from '@/lib/utils'

type Range = 'this_month' | 'last_month' | 'all_time'

function inRange(dateStr: string, range: Range): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  if (range === 'all_time') return true
  if (range === 'this_month')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth()
}

const RANGE_LABELS: { key: Range; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all_time',   label: 'All Time' },
]

export default function ProviderAnalyticsPage() {
  const { providerId } = useProfileIds()
  const [allBookings, setAllBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('this_month')

  useEffect(() => {
    if (!providerId) { setLoading(false); return }
    Promise.all([
      supabase
        .from('bookings')
        .select('status, total_amount, created_at')
        .eq('provider_id', providerId),
      supabase
        .from('provider_profiles')
        .select('rating_average, rating_count')
        .eq('id', providerId)
        .maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      setAllBookings(b ?? [])
      setProfile(p)
      setLoading(false)
    })
  }, [providerId])

  const filtered = allBookings.filter(b => inRange(b.created_at, range))

  const total     = filtered.length
  const completed = filtered.filter((x: any) => x.status === 'completed').length
  const cancelled = filtered.filter((x: any) => x.status === 'cancelled').length
  const revenue   = filtered
    .filter((x: any) => x.status === 'completed')
    .reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0)
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {/* Date range selector */}
        <div className="flex rounded-xl overflow-hidden ring-1 ring-gray-200 shrink-0">
          {RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={
                'px-4 py-2 text-sm font-medium transition-colors ' +
                (range === key
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50')
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ['Total Bookings',  total.toString()],
          ['Completed',       completed.toString()],
          ['Completion Rate', completionRate + '%'],
          ['Total Revenue',   formatCurrency(revenue / 100)],
          ['Avg Rating',      profile?.rating_average > 0 ? profile.rating_average.toFixed(1) + ' ★' : '—'],
          ['Total Reviews',   (profile?.rating_count ?? 0).toString()],
        ] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      {total === 0 && (
        <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No bookings for this period</p>
        </div>
      )}
    </div>
  )
}
