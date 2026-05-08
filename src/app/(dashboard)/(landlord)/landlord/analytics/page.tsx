'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/utils'

export default function LandlordAnalyticsPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ properties: 0, tenants: 0, bookings: 0, maintenance: 0, spend: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('properties').select('id', { count: 'exact' }).eq('landlord_id', user.id),
      supabase.from('tenants').select('id', { count: 'exact' }).eq('landlord_id', user.id).eq('is_active', true),
      supabase.from('bookings').select('id, total_amount').eq('landlord_id', user.id).eq('status', 'completed'),
      supabase.from('maintenance_requests').select('id', { count: 'exact' }).eq('landlord_id', user.id),
    ]).then(([p, t, b, m]) => {
      const bookings = b.data ?? []
      setStats({
        properties: p.count ?? 0,
        tenants: t.count ?? 0,
        bookings: bookings.length,
        maintenance: m.count ?? 0,
        spend: bookings.reduce((s, x) => s + (x.total_amount ?? 0), 0),
      })
      setLoading(false)
    })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {([
          ['Properties', stats.properties.toString()],
          ['Active Tenants', stats.tenants.toString()],
          ['Completed Bookings', stats.bookings.toString()],
          ['Maintenance Requests', stats.maintenance.toString()],
          ['Total Spend', formatCurrency(stats.spend / 100)],
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
