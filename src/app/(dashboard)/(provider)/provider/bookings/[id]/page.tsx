'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'
import { BookingPhotos } from '@/components/shared/BookingPhotos'

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

export default function ProviderBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [afterPhotoCount, setAfterPhotoCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('bookings')
      .select('*, service:services(title), customer_profile:customer_profiles(id, user_id, first_name, last_name), provider_profile:provider_profiles(id, user_id)')
      .eq('id', id).single()
      .then(({ data }) => { setBooking(data); setLoading(false) })
  }, [id])

  async function updateStatus(status: string) {
    setActing(true)
    const updates: Record<string, any> = { status }
    if (status === 'accepted') updates.accepted_at = new Date().toISOString()
    if (status === 'in_progress') updates.started_at = new Date().toISOString()
    await supabase.from('bookings').update(updates).eq('id', id)
    setBooking((b: any) => ({ ...b, status }))

    // Notify customer
    const customerUserId = booking?.customer_profile?.user_id
    if (customerUserId) {
      const notifMap: Record<string, { title: string; body: string }> = {
        accepted: { title: 'Booking accepted!', body: `Your booking #${booking.booking_number} has been accepted by the provider.` },
        rejected: { title: 'Booking declined', body: `Your booking #${booking.booking_number} was declined. You can search for another provider.` },
        in_progress: { title: 'Job started', body: `Your provider has started work on booking #${booking.booking_number}.` },
        completed: { title: 'Job marked complete', body: `Your provider marked booking #${booking.booking_number} complete. Please confirm to release payment.` },
      }
      const notif = notifMap[status]
      if (notif) {
        await supabase.from('notifications').insert({
          user_id: customerUserId,
          notification_type: `booking_${status}`,
          title: notif.title,
          body: notif.body,
          data: { booking_id: id },
        })
      }
    }
    setActing(false)
  }

  async function handleOpenMessage() {
    if (!booking) return
    const customerId = booking.customer_profile?.id
    const providerId = booking.provider_profile?.id
    if (!customerId || !providerId) return
    const { data: existing } = await supabase.from('conversations').select('id').eq('booking_id', id).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: conv } = await supabase.from('conversations').insert({
      booking_id: id, customer_id: customerId, provider_id: providerId, conversation_type: 'booking', status: 'active',
    }).select('id').single()
    if (conv) router.push(`/messages/${conv.id}`)
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>
  if (!booking) return <div className="text-gray-400">Booking not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Booking {booking.booking_number}</h1>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Status</span>
          <StatusBadge status={booking.status} />
        </div>
        {booking.service?.title && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Service</span>
            <span className="text-sm font-medium">{booking.service.title}</span>
          </div>
        )}
        {booking.customer_profile && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Customer</span>
            <span className="text-sm font-medium">{booking.customer_profile.first_name} {booking.customer_profile.last_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Date</span>
          <span className="text-sm font-medium">{formatDate(booking.scheduled_date)}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Time</span>
          <span className="text-sm font-medium">{booking.scheduled_time_start}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-gray-500">Job Amount</span>
          <span className="text-sm font-semibold">{formatCurrency((booking.base_amount ?? booking.total_amount) / 100)}</span>
        </div>
        {booking.commission_rate && (
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Commission ({Math.round(booking.commission_rate * 100)}%)</span>
            <span className="text-sm text-red-500">−{formatCurrency((booking.platform_fee ?? 0) / 100)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm font-semibold text-gray-700">Your Payout</span>
          <span className="text-sm font-bold text-green-700">
            {formatCurrency(((booking.base_amount ?? booking.total_amount) - (booking.platform_fee ?? 0)) / 100)}
          </span>
        </div>
        {booking.is_emergency && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">🚨 Emergency booking — 15% commission</div>}
        {['pending','accepted','in_progress'].includes(booking.status) && booking.total_amount > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
            <span>🔒</span>
            <div>
              <p className="text-sm font-semibold text-blue-900">Payment in escrow</p>
              <p className="text-xs text-blue-700 mt-0.5">Released to you once the customer confirms job completion.</p>
            </div>
          </div>
        )}
        {booking.status === 'completed' && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
            <span>✅</span>
            <div>
              <p className="text-sm font-semibold text-green-900">Payment released</p>
              <p className="text-xs text-green-700 mt-0.5">
                {formatCurrency(((booking.base_amount ?? booking.total_amount) - (booking.platform_fee ?? 0)) / 100)} has been released to your account.
              </p>
            </div>
          </div>
        )}
        {booking.customer_notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">Customer notes</p>
            <p className="text-sm text-gray-700">{booking.customer_notes}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {booking.status === 'pending' && <>
          <button onClick={() => updateStatus('accepted')} disabled={acting} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">Accept</button>
          <button onClick={() => updateStatus('rejected')} disabled={acting} className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
        </>}
        {booking.status === 'accepted' && (
          <button onClick={() => updateStatus('in_progress')} disabled={acting} className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">Mark In Progress</button>
        )}
        {booking.status === 'in_progress' && (
          <button
            onClick={() => {
              if (afterPhotoCount === 0) {
                if (!confirm('No after photos uploaded yet. It\'s recommended to add after photos before marking complete. Continue anyway?')) return
              }
              updateStatus('completed')
            }}
            disabled={acting}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark Completed
          </button>
        )}
        {['pending','accepted','in_progress'].includes(booking.status) && (
          <button onClick={handleOpenMessage} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            💬 Message
          </button>
        )}
      </div>

      <BookingPhotos
        bookingId={id as string}
        bookingStatus={booking.status}
        isProvider={true}
        onAfterPhotoCount={setAfterPhotoCount}
      />
    </div>
  )
}
