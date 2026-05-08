'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-yellow-100 text-yellow-700',
  accepted:     'bg-blue-100 text-primary',
  in_progress:  'bg-purple-100 text-purple-700',
  completed:    'bg-green-100 text-green-700',
  cancelled:    'bg-gray-100 text-gray-500',
  rejected:     'bg-red-100 text-red-700',
  resolved:     'bg-green-100 text-green-700',
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-orange-100 text-orange-700',
}
const PRIORITY_COLORS: Record<string, string> = {
  low:       'bg-gray-100 text-gray-600',
  medium:    'bg-primary/[0.06] text-primary',
  high:      'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function TenantMaintenanceHistoryPage() {
  const { tenantId } = useProfileIds()
  const [requests, setRequests] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'requests' | 'bookings'>('requests')

  useEffect(() => {
    if (!tenantId) return
    Promise.all([
      supabase
        .from('maintenance_requests')
        .select('*, booking:bookings(id, status, scheduled_date, service:services(title), provider:provider_profiles(first_name, last_name, business_name))')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bookings')
        .select('id, booking_number, scheduled_date, status, service:services(title, category), provider:provider_profiles(first_name, last_name, business_name)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    ]).then(([{ data: reqs }, { data: bks }]) => {
      setRequests(reqs ?? [])
      setBookings(bks ?? [])
      setLoading(false)
    })
  }, [tenantId])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Service History</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        {(['requests', 'bookings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={'pb-2 px-3 text-sm font-medium capitalize border-b-2 transition ' +
              (tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'requests' ? 'Repair Requests' : 'Scheduled Services'}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        requests.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const booking = r.booking
              return (
                <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{r.title}</p>
                        <span className={'rounded-full px-2 py-0.5 text-xs font-medium capitalize ' + (PRIORITY_COLORS[r.priority] ?? 'bg-gray-100 text-gray-600')}>
                          {r.priority}
                        </span>
                      </div>
                      {r.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description}</p>}
                      <p className="text-xs text-gray-400 mt-2">Submitted {formatDate(r.created_at)}</p>
                      {/* If linked to a booking, show provider (no cost) */}
                      {booking && (
                        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                          <span className="font-medium">Provider: </span>
                          {booking.provider?.business_name ?? `${booking.provider?.first_name} ${booking.provider?.last_name}`}
                          {' · '}
                          {formatDate(booking.scheduled_date)}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'bookings' && (
        bookings.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const provider = b.provider
              const providerName = provider?.business_name ?? (`${provider?.first_name ?? ''} ${provider?.last_name ?? ''}`.trim() || 'Unknown provider')
              return (
                <div key={b.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{b.service?.title ?? b.booking_number}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{providerName}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(b.scheduled_date)}</p>
                      {/* NOTE: cost is intentionally not shown for tenants */}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
