'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
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

export default function LandlordBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('bookings').select('*').eq('id', id).single().then(({ data }) => { setBooking(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!booking) return <div className="text-gray-400">Booking not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Booking {booking.booking_number}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center justify-between"><span className="text-sm text-gray-500">Status</span><StatusBadge status={booking.status} /></div>
        <div className="flex items-center justify-between border-t pt-4"><span className="text-sm text-gray-500">Date</span><span className="text-sm font-medium">{formatDate(booking.scheduled_date)}</span></div>
        <div className="flex items-center justify-between border-t pt-4"><span className="text-sm text-gray-500">Time</span><span className="text-sm font-medium">{booking.scheduled_time_start}</span></div>
        <div className="flex items-center justify-between border-t pt-4"><span className="text-sm text-gray-500">Amount</span><span className="text-sm font-semibold">{formatCurrency(booking.total_amount / 100)}</span></div>
        {booking.customer_notes && <div className="border-t pt-4"><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700">{booking.customer_notes}</p></div>}
      </div>
    </div>
  )
}
