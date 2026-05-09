'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
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

export default function LandlordBookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    let q = supabase.from('bookings').select('*').eq('landlord_id', user.id).order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    q.then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [user?.id, filter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ' + (filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-blue-300')}>
            {f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        bookings.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No bookings</p></div> : (
          <div className="space-y-3">
            {bookings.map(b => (
              <Link key={b.id} href={'/landlord/bookings/' + b.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                <div><p className="font-medium text-gray-900">{b.booking_number}</p><p className="text-sm text-gray-500">{formatDate(b.scheduled_date)}</p></div>
                <div className="flex items-center gap-3"><StatusBadge status={b.status} /><span className="text-sm font-medium">{formatCurrency(b.total_amount / 100)}</span></div>
              </Link>
            ))}
          </div>
        )
      }
    </div>
  )
}
