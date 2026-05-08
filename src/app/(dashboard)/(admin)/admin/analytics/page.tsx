'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'

// ── Simple SVG bar chart (no deps) ─────────────────────────────────────────

function BarChart({ data, color = '#1a56db' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const h = 120
  const barW = Math.floor(400 / data.length) - 6

  return (
    <svg viewBox={`0 0 400 ${h + 28}`} className="w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const barH = Math.round((d.value / max) * h)
        const x = i * (400 / data.length) + 3
        const y = h - barH
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#374151">{d.value}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState({
    users: 0, providers: 0, customers: 0,
    bookings: 0, completed: 0, cancelled: 0,
    gmv: 0, avgJobValue: 0,
    disputes: 0, pendingVerification: 0,
  })
  const [bookingsByStatus, setBookingsByStatus] = useState<{ label: string; value: number }[]>([])
  const [bookingsByMonth, setBookingsByMonth]   = useState<{ label: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, roles', { count: 'exact' }),
      supabase.from('provider_profiles').select('id, is_verified', { count: 'exact' }),
      supabase.from('bookings').select('id, status, total_amount, created_at'),
      supabase.from('disputes').select('id, status', { count: 'exact' }),
    ]).then(([u, p, b, d]) => {
      const users    = u.data ?? []
      const provData = p.data ?? []
      const bData    = b.data ?? []
      const dData    = d.data ?? []

      const completed  = bData.filter((x: any) => x.status === 'completed')
      const cancelled  = bData.filter((x: any) => x.status === 'cancelled')
      const gmv        = completed.reduce((s: number, x: any) => s + (x.total_amount ?? 0), 0)
      const avgJob     = completed.length > 0 ? gmv / completed.length : 0

      // Bookings by status
      const statusCounts: Record<string, number> = {}
      bData.forEach((b: any) => { statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1 })
      const statusChart = Object.entries(statusCounts).map(([label, value]) => ({
        label: label.replace('_', ' ').slice(0, 8),
        value,
      }))

      // Bookings by month (last 6 months)
      const now = new Date()
      const months: { label: string; value: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const label = d.toLocaleString('default', { month: 'short' })
        const count = bData.filter((b: any) => {
          const created = new Date(b.created_at)
          return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth()
        }).length
        months.push({ label, value: count })
      }

      setStats({
        users: u.count ?? 0,
        providers: provData.filter((p: any) => p.is_verified).length,
        customers: users.filter((u: any) => u.roles?.includes('customer')).length,
        bookings: bData.length,
        completed: completed.length,
        cancelled: cancelled.length,
        gmv,
        avgJobValue: avgJob,
        disputes: dData.filter((d: any) => d.status === 'open').length,
        pendingVerification: provData.filter((p: any) => !p.is_verified).length,
      })
      setBookingsByStatus(statusChart)
      setBookingsByMonth(months)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  const completionRate = stats.bookings > 0
    ? Math.round((stats.completed / stats.bookings) * 100)
    : 0

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users"          value={stats.users.toString()} />
        <StatCard label="Verified Providers"   value={stats.providers.toString()} sub={`${stats.pendingVerification} pending`} />
        <StatCard label="Gross Merchandise Value" value={formatCurrency(stats.gmv / 100)} />
        <StatCard label="Avg Job Value"        value={formatCurrency(stats.avgJobValue / 100)} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Bookings"       value={stats.bookings.toString()} />
        <StatCard label="Completion Rate"      value={completionRate + '%'} sub={`${stats.completed} completed`} />
        <StatCard label="Cancellations"        value={stats.cancelled.toString()} />
        <StatCard label="Open Disputes"        value={stats.disputes.toString()} />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="mb-4 text-sm font-semibold text-gray-700">Bookings — Last 6 Months</p>
          <BarChart data={bookingsByMonth} color="#1a56db" />
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="mb-4 text-sm font-semibold text-gray-700">Bookings by Status</p>
          <BarChart data={bookingsByStatus} color="#7c3aed" />
        </div>
      </div>

      {/* ── Summary table ── */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-3">Metric</th>
              <th className="px-5 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              ['Total registered users',    stats.users.toString()],
              ['Active customers',          stats.customers.toString()],
              ['Verified providers',        stats.providers.toString()],
              ['Providers awaiting review', stats.pendingVerification.toString()],
              ['Total bookings',            stats.bookings.toString()],
              ['Completed jobs',            stats.completed.toString()],
              ['Cancelled jobs',            stats.cancelled.toString()],
              ['Job completion rate',       completionRate + '%'],
              ['Gross Merchandise Value',   formatCurrency(stats.gmv / 100)],
              ['Average job value',         formatCurrency(stats.avgJobValue / 100)],
              ['Open disputes',             stats.disputes.toString()],
            ].map(([label, val]) => (
              <tr key={label} className="hover:bg-gray-50">
                <td className="px-5 py-3 text-gray-700">{label}</td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
