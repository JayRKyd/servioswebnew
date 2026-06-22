'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, formatCurrency } from '@/lib/utils'
import { TrendingUp, Briefcase, PoundSterling, BarChart2, ArrowUpRight } from 'lucide-react'

const PERIODS = [
  { label: 'This month', value: 'month' },
  { label: 'Last 3 months', value: '3months' },
  { label: 'This year', value: 'year' },
  { label: 'All time', value: 'all' },
]

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProviderEarningsPage() {
  const { providerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    if (!providerId) return
    supabase.from('bookings')
      .select('*, service:services(title), customer_profile:customer_profiles(first_name, last_name, profile_image_url)')
      .eq('provider_id', providerId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [providerId])

  function net(b: any) {
    const base = b.base_amount ?? b.total_amount ?? 0
    const fee = b.platform_fee ?? Math.round(base * (b.commission_rate ?? 0.12))
    return base - fee
  }

  const now = new Date()

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      const d = new Date(b.completed_at ?? b.updated_at)
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (period === '3months') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1)
      if (period === 'year') return d.getFullYear() === now.getFullYear()
      return true
    })
  }, [bookings, period])

  const thisMonthJobs = bookings.filter(b => {
    const d = new Date(b.completed_at ?? b.updated_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const monthNet   = thisMonthJobs.reduce((s, b) => s + net(b), 0)
  const totalNet   = filtered.reduce((s, b) => s + net(b), 0)
  const totalFees  = filtered.reduce((s, b) => s + (b.platform_fee ?? 0), 0)
  const totalGross = filtered.reduce((s, b) => s + (b.base_amount ?? b.total_amount ?? 0), 0)
  const avgJob     = filtered.length > 0 ? Math.round(totalNet / filtered.length) : 0

  // Last 6 months bars
  const bars = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = monthKey(d)
      const val = bookings
        .filter(b => monthKey(new Date(b.completed_at ?? b.updated_at)) === key)
        .reduce((s, b) => s + net(b), 0)
      return { key, label: d.toLocaleDateString('en-GB', { month: 'short' }), val }
    })
  }, [bookings])

  const maxBar = Math.max(...bars.map(b => b.val), 1)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-0.5 text-sm text-gray-400">Your payouts after Servios platform commission</p>
        </div>
        {/* Period tabs */}
        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                period === p.value ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Primary card */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-primary to-primary/75 p-5 text-white shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Net This Month</p>
            <div className="rounded-lg bg-white/15 p-1.5"><TrendingUp size={14} /></div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(monthNet / 100)}</p>
          <p className="mt-1.5 text-xs text-white/60">{thisMonthJobs.length} job{thisMonthJobs.length !== 1 ? 's' : ''} this month</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Net</p>
            <div className="rounded-lg bg-green-50 p-1.5"><PoundSterling size={14} className="text-green-600" /></div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalNet / 100)}</p>
          <p className="mt-1.5 text-xs text-gray-400">{filtered.length} job{filtered.length !== 1 ? 's' : ''} in period</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Jobs Done</p>
            <div className="rounded-lg bg-blue-50 p-1.5"><Briefcase size={14} className="text-blue-600" /></div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{filtered.length}</p>
          <p className="mt-1.5 text-xs text-gray-400">{formatCurrency(totalFees / 100)} commission paid</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg. Job Value</p>
            <div className="rounded-lg bg-purple-50 p-1.5"><BarChart2 size={14} className="text-purple-600" /></div>
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(avgJob / 100)}</p>
          <p className="mt-1.5 text-xs text-gray-400">net per completed job</p>
        </div>
      </div>

      {/* ── 6-month bar chart ── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <p className="mb-5 text-sm font-semibold text-gray-900">Monthly Earnings — Last 6 Months</p>
        <div className="flex items-end gap-2" style={{ height: '120px' }}>
          {bars.map(b => {
            const pct = (b.val / maxBar) * 100
            const isCurrent = b.key === monthKey(now)
            return (
              <div key={b.key} className="flex flex-1 flex-col items-center gap-1">
                {b.val > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                    {formatCurrency(b.val / 100)}
                  </span>
                )}
                <div className="relative flex w-full flex-1 flex-col justify-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${isCurrent ? 'bg-primary' : 'bg-primary/20 hover:bg-primary/40'}`}
                    style={{ height: b.val > 0 ? `${Math.max(pct, 5)}%` : '2px', opacity: b.val === 0 ? 0.3 : 1 }}
                  />
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-primary' : 'text-gray-400'}`}>
                  {b.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Transaction table ── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Transaction History</h2>

        {loading ? (
          <div className="flex h-32 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-100">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No completed jobs in this period</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Job</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Customer</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Gross</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Commission</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Net Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(b => {
                  const gross = b.base_amount ?? b.total_amount ?? 0
                  const fee   = b.platform_fee ?? Math.round(gross * (b.commission_rate ?? 0.12))
                  const payout = gross - fee
                  const rate  = b.commission_rate ? `${Math.round(b.commission_rate * 100)}%` : '12%'
                  const cp    = b.customer_profile
                  const initials = cp ? `${cp.first_name?.[0] ?? ''}${cp.last_name?.[0] ?? ''}`.toUpperCase() : '?'
                  const customerName = cp ? `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim() : 'Customer'

                  return (
                    <tr key={b.id} className="group transition-colors hover:bg-gray-50/60">
                      {/* Job */}
                      <td className="px-5 py-4">
                        <Link href={`/provider/bookings/${b.id}`} className="group/link flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 group-hover/link:text-primary transition-colors">
                            {b.service?.title ?? 'Booking'}
                          </span>
                          <ArrowUpRight size={12} className="text-gray-300 transition-colors group-hover/link:text-primary" />
                        </Link>
                        {b.is_emergency && (
                          <span className="mt-0.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                            Emergency
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {cp?.profile_image_url
                              ? <img src={cp.profile_image_url} alt="" className="h-7 w-7 object-cover" />
                              : initials}
                          </div>
                          <span className="text-gray-600">{customerName}</span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-gray-400">{formatDate(b.scheduled_date)}</td>

                      {/* Gross */}
                      <td className="px-5 py-4 text-right font-medium text-gray-700">{formatCurrency(gross / 100)}</td>

                      {/* Commission */}
                      <td className="px-5 py-4 text-right">
                        <span className="font-medium text-red-500">−{formatCurrency(fee / 100)}</span>
                        <span className="ml-1 text-xs text-gray-300">({rate})</span>
                      </td>

                      {/* Net payout */}
                      <td className="px-5 py-4 text-right">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-700">
                          {formatCurrency(payout / 100)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/80">
                  <td colSpan={3} className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Period Total
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-gray-700">
                    {formatCurrency(totalGross / 100)}
                  </td>
                  <td className="px-5 py-4 text-right text-sm font-bold text-red-500">
                    −{formatCurrency(totalFees / 100)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                      {formatCurrency(totalNet / 100)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
