'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, providers_pending: 0, bookings: 0, disputes: 0, revenue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('provider_profiles').select('id', { count: 'exact' }).eq('is_verified', false).eq('is_active', true),
      supabase.from('bookings').select('id, total_amount').eq('status', 'completed'),
      supabase.from('disputes').select('id', { count: 'exact' }).eq('status', 'open'),
    ]).then(([u, p, b, d]) => {
      const bData = b.data ?? []
      setStats({
        users: u.count ?? 0,
        providers_pending: p.count ?? 0,
        bookings: bData.length,
        disputes: d.count ?? 0,
        revenue: bData.reduce((s, x) => s + (x.total_amount ?? 0), 0),
      })
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {stats.providers_pending > 0 && (
        <div className="rounded-lg bg-yellow-50 p-4 border border-yellow-200">
          <p className="text-sm font-medium text-yellow-800">{stats.providers_pending} provider{stats.providers_pending !== 1 ? 's' : ''} awaiting verification</p>
          <Link href="/admin/providers/verification" className="mt-1 text-sm text-yellow-700 underline">Review now →</Link>
        </div>
      )}

      {stats.disputes > 0 && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-medium text-red-800">{stats.disputes} open dispute{stats.disputes !== 1 ? 's' : ''}</p>
          <Link href="/admin/disputes" className="mt-1 text-sm text-red-700 underline">View disputes →</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? null : ([
          ['Total Users', stats.users.toString()],
          ['Pending Verification', stats.providers_pending.toString()],
          ['Completed Bookings', stats.bookings.toString()],
          ['Open Disputes', stats.disputes.toString()],
          ['Platform Revenue', formatCurrency(stats.revenue / 100)],
        ] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Users', '/admin/users'], ['Providers', '/admin/providers'], ['Bookings', '/admin/bookings'], ['Disputes', '/admin/disputes']] as const).map(([label, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-white p-4 text-center text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30">{label}</Link>
        ))}
      </div>
    </div>
  )
}
