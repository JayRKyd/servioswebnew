'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function ProviderEarningsPage() {
  const { providerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) return
    supabase.from('bookings')
      .select('*, service:services(title)')
      .eq('provider_id', providerId).eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [providerId])

  function netPayout(b: any) {
    const base = b.base_amount ?? b.total_amount ?? 0
    const commission = b.platform_fee ?? Math.round(base * (b.commission_rate ?? 0.12))
    return base - commission
  }

  const now = new Date()
  const thisMonth = bookings.filter(b => {
    const d = new Date(b.completed_at ?? b.updated_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const totalNet = bookings.reduce((sum, b) => sum + netPayout(b), 0)
  const monthNet = thisMonth.reduce((sum, b) => sum + netPayout(b), 0)
  const totalCommission = bookings.reduce((sum, b) => sum + (b.platform_fee ?? 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([
          ['Net This Month', formatCurrency(monthNet / 100)],
          ['Total Net Earned', formatCurrency(totalNet / 100)],
          ['Jobs Completed', bookings.length.toString()],
        ] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      {totalCommission > 0 && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          Total platform commission deducted: <span className="font-semibold text-gray-900">{formatCurrency(totalCommission / 100)}</span>
        </div>
      )}

      <div>
        <h2 className="mb-3 font-semibold text-gray-900">Completed Jobs</h2>
        {loading ? <div className="flex h-24 items-center justify-center text-gray-400">Loading…</div> :
          bookings.length === 0 ? <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No completed jobs yet</p></div> : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map(b => {
                    const gross = b.base_amount ?? b.total_amount ?? 0
                    const commission = b.platform_fee ?? Math.round(gross * (b.commission_rate ?? 0.12))
                    const net = gross - commission
                    const rate = b.commission_rate ? `${Math.round(b.commission_rate * 100)}%` : '12%'
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{b.service?.title ?? b.booking_number}</p>
                          <p className="text-xs text-gray-400">{b.booking_number}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(b.scheduled_date)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(gross / 100)}</td>
                        <td className="px-4 py-3 text-right text-red-500">−{formatCurrency(commission / 100)} <span className="text-xs text-gray-400">({rate})</span></td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(net / 100)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  )
}
