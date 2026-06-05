'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
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

export default function ProviderDashboard() {
  const { user } = useAuth()
  const { providerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<{ landlord_name: string } | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data: p }) => {
        setProfile(p)
        if (!p) { setLoading(false); return }
        supabase.from('bookings').select('*').eq('provider_id', p.id).order('created_at', { ascending: false }).limit(5)
          .then(({ data: b }) => { setBookings(b ?? []); setLoading(false) })
      })
  }, [user?.id])

  useEffect(() => {
    if (!providerId) return
    supabase
      .from('provider_invitations')
      .select('id, invited_by_landlord_id, invitation_message')
      .eq('provider_id', providerId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle()
      .then(async ({ data: inv }) => {
        if (!inv) return
        const { data: lp } = await supabase
          .from('landlord_profiles')
          .select('first_name, last_name, company_name')
          .eq('id', inv.invited_by_landlord_id)
          .maybeSingle()
        if (lp) {
          const name = (lp as any).company_name || `${(lp as any).first_name ?? ''} ${(lp as any).last_name ?? ''}`.trim() || 'a landlord'
          setInvitation({ landlord_name: name })
        }
      })
  }, [providerId])

  const pending = bookings.filter(b => b.status === 'pending').length
  const upcoming = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length
  const name = profile?.first_name ?? 'Provider'

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        <p className="mt-1 text-blue-200">{pending} pending request{pending !== 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([['Pending', pending], ['Upcoming', upcoming], ['Rating', profile?.rating_average?.toFixed(1) ?? '—']] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      {invitation && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-start gap-3">
          <span className="text-xl shrink-0">🤝</span>
          <div>
            <p className="text-sm font-semibold text-green-900">You were invited by {invitation.landlord_name}</p>
            <p className="text-sm text-green-700 mt-0.5">You earn a reduced <strong>10% commission rate</strong> on jobs booked through them.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Requests', '/provider/bookings'], ['Calendar', '/provider/calendar'], ['Earnings', '/provider/earnings'], ['Messages', '/messages']] as const).map(([label, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-white p-4 text-center text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">{label}</Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Requests</h2>
        {loading ? <div className="flex h-24 items-center justify-center text-gray-400">Loading…</div> :
          bookings.length === 0 ? <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No bookings yet</p></div> : (
            <div className="space-y-3">
              {bookings.map(b => (
                <Link key={b.id} href={'/provider/bookings/' + b.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                  <div>
                    <p className="font-medium text-gray-900">{b.booking_number}</p>
                    <p className="text-sm text-gray-500">{formatDate(b.scheduled_date)} · {b.scheduled_time_start}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={b.status} />
                    <span className="text-sm font-medium">{formatCurrency(b.total_amount / 100)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
