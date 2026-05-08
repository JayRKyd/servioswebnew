'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  accepted:    'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
  rejected:    'bg-red-100 text-red-700',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function PropertyHistoryPage() {
  const { id } = useParams()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all')

  useEffect(() => {
    supabase
      .from('bookings')
      .select(`
        *,
        service:services(title, category),
        provider:provider_profiles(first_name, last_name, business_name, trade_category),
        photos:booking_photos(id)
      `)
      .eq('property_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [id])

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter)

  const totalSpend = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_amount ?? 0), 0)

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Service History</h1>
        <div className="text-sm text-gray-500">{bookings.length} bookings total</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 text-center">
          <p className="text-2xl font-bold text-gray-900">{bookings.filter(b => b.status === 'completed').length}</p>
          <p className="text-xs text-gray-500 mt-1">Completed</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 text-center">
          <p className="text-2xl font-bold text-gray-900">{bookings.filter(b => b.status === 'in_progress').length}</p>
          <p className="text-xs text-gray-500 mt-1">In Progress</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 text-center">
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalSpend / 100)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Spend</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'completed', 'in_progress', 'pending'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'pb-2 px-1 text-sm font-medium capitalize transition border-b-2 ' +
              (filter === f ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {f.replace('_', ' ')} {f === 'all' ? `(${bookings.length})` : `(${bookings.filter(b => b.status === f).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const provider = b.provider
            const providerName = provider?.business_name ?? `${provider?.first_name ?? ''} ${provider?.last_name ?? ''}`.trim() || 'Unknown provider'
            const photoCount = b.photos?.length ?? 0
            return (
              <Link key={b.id} href={`/landlord/bookings/${b.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:ring-blue-200 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {b.service?.title ?? b.booking_number}
                      </p>
                      {b.is_emergency && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">🚨 Emergency</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{providerName}</p>
                    {b.service?.category && (
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{b.service.category}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-400">{formatDate(b.scheduled_date)}</span>
                      {photoCount > 0 && (
                        <span className="text-xs text-gray-400">📷 {photoCount} photo{photoCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={b.status} />
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(b.total_amount / 100)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
