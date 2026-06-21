'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'

export default function LandlordBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('bookings')
      .select('*, service:services(title), provider_profile:provider_profiles(first_name, last_name, business_name, profile_image_url)')
      .eq('id', id).single()
      .then(({ data }) => { setBooking(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!booking) return <div className="text-gray-400">Booking not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="mt-1 text-sm text-primary hover:underline">← Back</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {booking.service?.title ?? 'Booking'}
            {booking.provider_profile ? ` — ${booking.provider_profile.business_name ?? booking.provider_profile.first_name}` : ''}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">#{(id as string).slice(-6).toUpperCase()}</p>
        </div>
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
