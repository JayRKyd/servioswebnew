'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'
import { BookingPhotos } from '@/components/shared/BookingPhotos'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  pending_customer_confirmation: 'bg-amber-100 text-amber-700',
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

interface MilestoneForm {
  title: string
  amount: string
  due_date: string
  description: string
}

const EMPTY_FORM: MilestoneForm = { title: '', amount: '', due_date: '', description: '' }

export default function ProviderBookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const milestonesRef = useRef<HTMLDivElement>(null)
  const [booking, setBooking] = useState<any>(null)
  const [milestones, setMilestones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [afterPhotoCount, setAfterPhotoCount] = useState<number | null>(null)

  // Milestone form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<MilestoneForm>(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit state — keyed by milestone id
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<MilestoneForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  async function loadMilestones() {
    const { data } = await supabase
      .from('booking_milestones')
      .select('*')
      .eq('booking_id', id)
      .order('milestone_number', { ascending: true })
    setMilestones(data ?? [])
  }

  useEffect(() => {
    supabase.from('bookings')
      .select('*, service:services(title), customer_profile:customer_profiles(id, user_id, first_name, last_name), provider_profile:provider_profiles(id, user_id)')
      .eq('id', id).single()
      .then(({ data }) => { setBooking(data); setLoading(false) })
    loadMilestones()
    // Scroll to milestones section if hash present
    if (typeof window !== 'undefined' && window.location.hash === '#milestones') {
      setTimeout(() => milestonesRef.current?.scrollIntoView({ behavior: 'smooth' }), 400)
    }
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
        pending_customer_confirmation: { title: 'Job complete — action needed', body: `Your provider has finished booking #${booking.booking_number}. Please confirm to release payment.` },
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

  async function handleAddMilestone() {
    if (!addForm.title.trim()) { setAddError('Title is required'); return }
    const amount = parseFloat(addForm.amount)
    if (isNaN(amount) || amount <= 0) { setAddError('Enter a valid amount in £'); return }
    setAddSaving(true); setAddError(null)
    const nextNumber = milestones.length + 1
    const commissionRate = booking?.commission_rate ?? 0.12
    const { error } = await supabase.from('booking_milestones').insert({
      booking_id: id,
      title: addForm.title.trim(),
      description: addForm.description.trim() || null,
      amount,
      provider_amount: amount * (1 - commissionRate),
      platform_commission: amount * commissionRate,
      milestone_number: nextNumber,
      due_date: addForm.due_date || null,
      status: 'pending',
    })
    if (error) { setAddError(error.message); setAddSaving(false); return }
    setAddForm(EMPTY_FORM); setShowAddForm(false)
    await loadMilestones()
    setAddSaving(false)
  }

  async function handleEditSave(milestoneId: string) {
    if (!editForm.title.trim()) return
    const amount = parseFloat(editForm.amount)
    if (isNaN(amount) || amount <= 0) return
    setEditSaving(true)
    const commissionRate = booking?.commission_rate ?? 0.12
    await supabase.from('booking_milestones').update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      amount,
      provider_amount: amount * (1 - commissionRate),
      platform_commission: amount * commissionRate,
      due_date: editForm.due_date || null,
    }).eq('id', milestoneId)
    setEditingId(null)
    await loadMilestones()
    setEditSaving(false)
  }

  async function handleDeleteMilestone(milestoneId: string) {
    if (!confirm('Remove this milestone?')) return
    await supabase.from('booking_milestones').delete().eq('id', milestoneId)
    setMilestones((prev) => prev.filter((m) => m.id !== milestoneId))
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>
  if (!booking) return <div className="text-gray-400">Booking not found.</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Booking {booking.booking_number}</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px] lg:items-start">
      {/* Left column */}
      <div className="space-y-5">

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
            <span className="text-sm text-gray-500">Commission ({booking.commission_rate <= 1 ? Math.round(booking.commission_rate * 100) : Math.round(booking.commission_rate)}%)</span>
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
        {booking.status === 'pending_customer_confirmation' && booking.total_amount > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
            <span>⏳</span>
            <div>
              <p className="text-sm font-semibold text-amber-900">Awaiting customer confirmation</p>
              <p className="text-xs text-amber-700 mt-0.5">The customer has been notified. Payment releases once they confirm.</p>
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

      {/* Commission transparency banner — shown only when action is needed */}
      {booking.status === 'pending' && (() => {
        const gross = booking.base_amount ?? booking.total_amount ?? 0
        const rate = booking.commission_rate ?? 0.12
        const rateLabel = booking.is_emergency
          ? '15% (emergency)'
          : rate <= 0.10
          ? '10% — invited provider'
          : '12% — standard'
        const commission = Math.round(gross * (booking.is_emergency ? 0.15 : rate))
        const net = gross - commission
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-amber-900">Review before accepting</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-amber-800">
              <span>Commission: <strong>{rateLabel}</strong></span>
              <span>You&apos;ll receive: <strong>{formatCurrency(net / 100)}</strong></span>
            </div>
          </div>
        )
      })()}

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
              updateStatus('pending_customer_confirmation')
            }}
            disabled={acting}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Mark as Done
          </button>
        )}
        {['pending','accepted','in_progress','pending_customer_confirmation'].includes(booking.status) && (
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

      {/* end left column */}
      </div>

      {/* ── Right column: Milestones ─────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6">

      {/* ── Milestones ──────────────────────────────────────────────────────── */}
      <div ref={milestonesRef} id="milestones" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Milestones</h2>
          {['accepted', 'in_progress'].includes(booking.status) && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add milestone
            </button>
          )}
        </div>

        {/* Existing milestones */}
        {milestones.length === 0 && !showAddForm && (
          <p className="text-sm text-gray-400">
            {['accepted', 'in_progress'].includes(booking.status)
              ? 'No milestones yet. Add one above to break the job into payment stages.'
              : 'No milestones set for this booking.'}
          </p>
        )}

        {milestones.length > 0 && (
          <ol className="relative border-l border-gray-200 space-y-4 ml-2">
            {milestones.map((m: any) => {
              const released = m.status === 'released'
              const isEditing = editingId === m.id
              return (
                <li key={m.id} className="ml-4">
                  <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${released ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {released && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
                        <path d="M1.5 5l2.5 2.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>

                  {isEditing ? (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/[0.04] p-3">
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Title"
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
                          <input
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="0.00"
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full rounded-lg border border-gray-200 pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <input
                          value={editForm.due_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                          type="date"
                          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Description (optional)"
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSave(m.id)}
                          disabled={editSaving}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                        >
                          {editSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`text-sm font-medium leading-tight ${released ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {m.milestone_number}. {m.title}
                        </p>
                        {m.description && <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>}
                        {m.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {m.due_date}</p>}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">£{Number(m.amount).toFixed(2)}</p>
                          <span className={`text-[11px] font-medium capitalize ${released ? 'text-green-600' : 'text-gray-400'}`}>
                            {m.status}
                          </span>
                        </div>
                        {!released && ['accepted', 'in_progress'].includes(booking.status) && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => {
                                setEditingId(m.id)
                                setEditForm({ title: m.title, amount: String(m.amount), due_date: m.due_date ?? '', description: m.description ?? '' })
                              }}
                              className="rounded p-1 text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteMilestone(m.id)}
                              className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Remove"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5">
                                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {/* Add milestone form */}
        {showAddForm && (
          <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Milestone</p>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            <input
              value={addForm.title}
              onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Milestone title (e.g. Initial survey)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
                <input
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <input
                value={addForm.due_date}
                onChange={(e) => setAddForm((f) => ({ ...f, due_date: e.target.value }))}
                type="date"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <textarea
              value={addForm.description}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddMilestone}
                disabled={addSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {addSaving ? 'Adding…' : 'Add Milestone'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); setAddError(null) }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Total */}
        {milestones.length > 0 && (
          <div className="flex justify-between border-t border-gray-100 pt-3">
            <span className="text-xs text-gray-500">Total across milestones</span>
            <span className="text-sm font-semibold text-gray-800">
              £{milestones.reduce((s, m) => s + Number(m.amount), 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>
      {/* end right column */}
      </div>
      {/* end grid */}
      </div>
    </div>
  )
}
