'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, formatCurrency, formatTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CalendarDays } from 'lucide-react'

const FILTERS = ['all', 'pending', 'accepted', 'in_progress', 'completed', 'rejected']

export default function ProviderBookingsPage() {
  const { providerId, loading: idsLoading } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) return
    setLoading(true)
    let q = supabase.from('bookings').select('*, service:services(title)').eq('provider_id', providerId).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    q.then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [providerId, filter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Booking Requests</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ' + (filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-primary/30')}>
            {f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/[0.08]">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <p className="mt-1 font-semibold text-gray-900">No booking requests yet</p>
            <p className="max-w-xs text-sm text-gray-500">
              When a customer books you, the request lands here. Keeping your availability up to date makes you bookable.
            </p>
            <Link href="/provider/availability" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Check my availability
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => (
              <Link key={b.id} href={'/provider/bookings/' + b.id} className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{b.service?.title ?? 'Booking'}</p>
                    <p className="text-sm text-gray-500">{formatDate(b.scheduled_date)} · {formatTime(b.scheduled_time_start)}</p>
                    {b.is_emergency && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Emergency</span>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={b.status} />
                    <span className="text-sm font-semibold">{formatCurrency(b.total_amount / 100)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      }
    </div>
  )
}
