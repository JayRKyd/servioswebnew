'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'

export default function ProviderAnalyticsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, revenue: 0, avg_rating: 0, rating_count: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('bookings').select('status, total_amount').eq('provider_id', user.id),
      supabase.from('provider_profiles').select('rating_average, rating_count').eq('user_id', user.id).maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      const all = b ?? []
      setStats({
        total: all.length,
        completed: all.filter((x: any) => x.status === 'completed').length,
        cancelled: all.filter((x: any) => x.status === 'cancelled').length,
        revenue: all.filter((x: any) => x.status === 'completed').reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0),
        avg_rating: p?.rating_average ?? 0,
        rating_count: p?.rating_count ?? 0,
      })
      setLoading(false)
    })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ['Total Bookings', stats.total.toString()],
          ['Completed', stats.completed.toString()],
          ['Completion Rate', completionRate + '%'],
          ['Total Revenue', formatCurrency(stats.revenue / 100)],
          ['Avg Rating', stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) + ' ★' : '—'],
          ['Total Reviews', stats.rating_count.toString()],
        ] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
