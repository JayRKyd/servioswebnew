'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatCurrency } from '@/lib/utils'

type ChartPoint = { label: string; completed: number; revenue: number }

function BarChart({ data }: { data: ChartPoint[] }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1)
  const maxCount = Math.max(...data.map(d => d.completed), 1)
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-primary/80 transition-all"
              style={{ height: `${(d.completed / maxCount) * 100}%`, minHeight: d.completed > 0 ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[10px] text-gray-400 truncate">{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProviderAnalyticsPage() {
  const { providerId } = useProfileIds()
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, revenue: 0, avg_rating: 0, rating_count: 0 })
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) return
    Promise.all([
      supabase.from('bookings').select('status, total_amount, scheduled_date').eq('provider_id', providerId),
      supabase.from('provider_profiles').select('rating_average, total_reviews').eq('id', providerId).maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      const all = b ?? []
      const completed = all.filter((x: any) => x.status === 'completed')
      setStats({
        total: all.length,
        completed: completed.length,
        cancelled: all.filter((x: any) => x.status === 'cancelled').length,
        revenue: completed.reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0),
        avg_rating: Number(p?.rating_average ?? 0),
        rating_count: p?.total_reviews ?? 0,
      })

      // Build last 6 months chart
      const months: ChartPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const label = d.toLocaleString('en-GB', { month: 'short' })
        const yr = d.getFullYear()
        const mo = d.getMonth()
        const slice = completed.filter((x: any) => {
          const dd = new Date(x.scheduled_date)
          return dd.getFullYear() === yr && dd.getMonth() === mo
        })
        months.push({ label, completed: slice.length, revenue: slice.reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0) })
      }
      setChartData(months)
      setLoading(false)
    })
  }, [providerId])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const noRatingData = stats.avg_rating === 0 && stats.rating_count === 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Chart */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-4">Completed jobs — last 6 months</p>
        {chartData.some(d => d.completed > 0)
          ? <BarChart data={chartData} />
          : <p className="text-sm text-gray-400 py-8 text-center">No completed bookings yet</p>
        }
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ['Total Bookings', stats.total.toString()],
          ['Completed', stats.completed.toString()],
          ['Completion Rate', stats.total > 0 ? completionRate + '%' : '—'],
          ['Total Revenue', stats.completed > 0 ? formatCurrency(stats.revenue / 100) : '—'],
          ['Avg Rating', noRatingData ? 'Not enough data yet' : stats.avg_rating.toFixed(1) + ' ★'],
          ['Total Reviews', noRatingData ? 'Not enough data yet' : stats.rating_count.toString()],
        ] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-1 font-bold text-gray-900 ${val.length > 8 ? 'text-base' : 'text-2xl'}`}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
