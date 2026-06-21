'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'

function relativeDate(dateStr: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(dateStr))
}

export default function ProviderDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data: p }) => {
        setProfile(p)
        if (!p) { setLoading(false); return }
        supabase.from('bookings')
          .select('*, service:services(title), customer_profile:customer_profiles(first_name, last_name)')
          .eq('provider_id', p.id).order('created_at', { ascending: false }).limit(5)
          .then(({ data: b }) => { setBookings(b ?? []); setLoading(false) })
      })
  }, [user?.id])

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

      <div className="grid grid-cols-2 gap-3 sm:hidden">
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
                    <p className="font-medium text-gray-900">
                      {b.service?.title ?? 'Booking'}
                      {b.customer_profile ? ` — ${b.customer_profile.first_name} ${b.customer_profile.last_name}` : ''}
                    </p>
                    <p className="text-sm text-gray-500">
                      {relativeDate(b.scheduled_date)}{b.scheduled_time_start ? ' · ' + formatTime(b.scheduled_time_start) : ''}
                    </p>
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
