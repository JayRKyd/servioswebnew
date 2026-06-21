'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency, formatTime } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'
import { BookingPhotos } from '@/components/shared/BookingPhotos'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { JobOfferPanel } from '@/components/shared/JobOfferPanel'
import { MilestoneTracker } from '@/components/shared/MilestoneTracker'
import { MessageCircle, Lock, CheckCircle2 } from 'lucide-react'

export default function ProviderBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking]           = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [acting, setActing]             = useState(false)
  const [afterPhotoCount, setAfterPhotoCount] = useState<number | null>(null)
  const [conversation, setConversation] = useState<any>(null)
  const [offer, setOffer]               = useState<any>(null)
  const [milestones, setMilestones]     = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: bk } = await supabase
        .from('bookings')
        .select('*, service:services(title, duration_minutes), customer_profile:customer_profiles(id, user_id, first_name, last_name, profile_image_url), provider_profile:provider_profiles(id, user_id)')
        .eq('id', id)
        .single()

      setBooking(bk)

      if (bk) {
        // Find linked conversation
        const { data: conv } = await supabase
          .from('conversations')
          .select('id, customer_id, provider_id, status')
          .eq('booking_id', id)
          .maybeSingle()

        if (conv) {
          // Build conversation object with full booking data for the panel
          setConversation({
            ...conv,
            booking: {
              id: bk.id,
              booking_number: bk.booking_number,
              status: bk.status,
              service: bk.service,
              base_amount: bk.base_amount,
              total_amount: bk.total_amount,
              platform_fee: bk.platform_fee,
              scheduled_date: bk.scheduled_date,
              scheduled_time_start: bk.scheduled_time_start,
            },
          })

          // Fetch offer via server API (bypasses RLS)
          const { data } = await apiClient<{ offer: any }>(`/api/v1/conversations/${conv.id}/offers`)
          setOffer(data?.offer ?? null)
        }

        // Fetch booking milestones
        const { data: ms } = await supabase
          .from('booking_milestones')
          .select('*')
          .eq('booking_id', bk.id)
          .order('milestone_number')
        setMilestones(ms ?? [])
      }

      setLoading(false)
    }
    load()
  }, [id])

  async function handleMilestoneStatusChange(milestoneId: string, newStatus: string) {
    await supabase.from('booking_milestones').update({ status: newStatus }).eq('id', milestoneId)
    setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, status: newStatus } : m))
  }

  async function handleMilestoneEdit(milestoneId: string, updates: { title: string; amount: number; due_date: string | null }) {
    await supabase.from('booking_milestones').update(updates).eq('id', milestoneId)
    setMilestones(prev => prev.map(m => m.id === milestoneId ? { ...m, ...updates } : m))
  }

  async function updateStatus(status: string) {
    setActing(true)
    const updates: Record<string, any> = { status }
    if (status === 'accepted') updates.accepted_at = new Date().toISOString()
    if (status === 'in_progress') updates.started_at = new Date().toISOString()
    await supabase.from('bookings').update(updates).eq('id', id)
    setBooking((b: any) => ({ ...b, status }))
    // Keep booking ref in conversation object in sync
    setConversation((c: any) => c ? { ...c, booking: { ...c.booking, status } } : c)

    const customerUserId = booking?.customer_profile?.user_id
    if (customerUserId) {
      const notifMap: Record<string, { title: string; body: string }> = {
        accepted:    { title: 'Booking accepted!',        body: 'Your booking has been accepted by the provider.' },
        rejected:    { title: 'Booking declined',         body: 'Your booking was declined. You can search for another provider.' },
        in_progress: { title: 'Job started',              body: 'Your provider has started work on your booking.' },
        completed:   { title: 'Job marked complete',      body: 'Your provider marked the job complete. Please confirm to release payment.' },
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
    const customerUserId = booking.customer_profile?.user_id
    const providerUserId = booking.provider_profile?.user_id
    if (!customerUserId || !providerUserId) return
    const { data: existing } = await supabase.from('conversations').select('id').eq('booking_id', id).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: conv } = await supabase.from('conversations').insert({
      booking_id: id, customer_id: customerUserId, provider_id: providerUserId, conversation_type: 'booking', status: 'active',
    }).select('id').single()
    if (conv) router.push(`/messages/${conv.id}`)
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
  if (!booking) return <div className="text-gray-400 p-6">Booking not found.</div>

  const cp = booking.customer_profile
  const initials = cp ? (cp.first_name?.[0] ?? '?').toUpperCase() : '?'

  const addressDisplay = (() => {
    const sa = booking.service_address
    if (!sa) return null
    if (typeof sa === 'string') return sa
    if (typeof sa === 'object') return sa.formatted_address ?? sa.line1 ?? JSON.stringify(sa)
    return null
  })()

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0">
      {/* ── Main booking details ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-start gap-3">
          <button onClick={() => router.back()} className="mt-1 text-sm text-primary hover:underline">← Back</button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {booking.service?.title ?? 'Booking'}
              {cp ? ` — ${cp.first_name} ${cp.last_name}` : ''}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Job &quot;{booking.service?.title ?? 'Booking'}&quot;</p>
          </div>
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

          {cp && (
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-gray-500">Customer</span>
              <div className="flex items-center gap-2">
                {cp.profile_image_url ? (
                  <img src={cp.profile_image_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                )}
                <p className="text-sm font-medium">{cp.first_name} {cp.last_name}</p>
              </div>
            </div>
          )}

          {addressDisplay && (
            <div className="flex items-start justify-between border-t pt-4">
              <span className="text-sm text-gray-500">Address</span>
              <span className="text-sm font-medium text-right max-w-xs">{addressDisplay}</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Date</span>
            <span className="text-sm font-medium">{formatDate(booking.scheduled_date)}</span>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm text-gray-500">Time</span>
            <span className="text-sm font-medium">{formatTime(booking.scheduled_time_start)}</span>
          </div>

          {booking.service?.duration_minutes && (
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-gray-500">Duration</span>
              <span className="text-sm font-medium">{booking.service.duration_minutes} min</span>
            </div>
          )}

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

          {booking.is_emergency && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              Emergency booking — 15% commission applies
            </div>
          )}

          {['pending', 'accepted', 'in_progress'].includes(booking.status) && booking.total_amount > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-3">
              <Lock size={16} className="mt-0.5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Payment in escrow</p>
                <p className="text-xs text-blue-700 mt-0.5">Released to you once the customer confirms job completion.</p>
              </div>
            </div>
          )}

          {booking.status === 'completed' && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 size={16} className="mt-0.5 text-green-600 shrink-0" />
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
            <button onClick={() => updateStatus('in_progress')} disabled={acting} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Mark In Progress</button>
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
          {['pending', 'accepted', 'in_progress'].includes(booking.status) && (
            <button onClick={handleOpenMessage} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <MessageCircle size={14} /> Message
            </button>
          )}
        </div>

        <BookingPhotos
          bookingId={id as string}
          bookingStatus={booking.status}
          isProvider={true}
          onAfterPhotoCount={setAfterPhotoCount}
        />

        {milestones.length > 0 && (
          <div id="milestones" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 scroll-mt-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Milestones</h2>
            <MilestoneTracker
              milestones={milestones}
              isProvider={true}
              onStatusChange={handleMilestoneStatusChange}
              onEdit={handleMilestoneEdit}
            />
          </div>
        )}
      </div>

      {/* ── Offer panel (desktop right column) ───────────────────────────── */}
      <div className="hidden lg:flex w-[360px] shrink-0 flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
        {conversation ? (
          <JobOfferPanel
            conversationId={conversation.id}
            conversation={conversation}
            offer={offer}
            isProvider={true}
            milestones={milestones}
            onOfferAction={(action) => {
              setOffer((prev: any) => ({ ...prev, status: action === 'accept' ? 'accepted' : 'declined' }))
            }}
          />
        ) : (
          <div className="p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Active Offer</h2>
            <p className="text-sm text-gray-500">No conversation started yet.</p>
            <button
              onClick={handleOpenMessage}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Start Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
