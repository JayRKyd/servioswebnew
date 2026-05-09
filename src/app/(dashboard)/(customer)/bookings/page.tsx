'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-primary',
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

const FILTERS = ['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled']

export default function CustomerBookingsPage() {
  const { customerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    setLoading(true)
    let q = supabase.from('bookings').select('*, service:services(title)').eq('customer_id', customerId).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    q.then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [customerId, filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
        <Link href="/bookings/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">+ New Booking</Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ' + (filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-blue-300')}>
            {f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><div className="text-gray-400">Loading…</div></div>
      ) : bookings.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No bookings found</p></div>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <Link key={b.id} href={'/bookings/' + b.id} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{b.service?.title ?? b.booking_number}</p>
                  <p className="mt-0.5 text-sm text-gray-400 text-xs">{b.booking_number}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{formatDate(b.scheduled_date)} · {b.scheduled_time_start}</p>
                  {b.is_emergency && <span className="mt-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Emergency</span>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={b.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(b.total_amount / 100)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
