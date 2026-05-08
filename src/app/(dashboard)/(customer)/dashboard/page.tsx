'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatCurrency } from '@/lib/utils'
import { CATEGORY_META } from '@/lib/service-questions'

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  accepted:    'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
  rejected:    'bg-red-100 text-red-700',
  approved:    'bg-green-100 text-green-700',
  scheduled:   'bg-blue-100 text-primary',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle()
      .then(async ({ data: cp }) => {
        if (!cp) { setLoading(false); return }
        const { data } = await supabase
          .from('bookings')
          .select('*, service:services(title)')
          .eq('customer_id', cp.id)
          .order('created_at', { ascending: false })
          .limit(5)
        setBookings(data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user?.id])

  const pending  = bookings.filter(b => b.status === 'pending').length
  const upcoming = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length

  const heroCategories = ['plumber', 'electrician', 'cleaner', 'hvac', 'painter', 'handyman']

  return (
    <div className="space-y-8">
      {/* ── Hero: what do you need? ─────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
        <h1 className="text-2xl font-bold">What service do you need?</h1>
        <p className="mt-1 text-blue-200 text-sm">Tell us what's needed and we'll find the right pro.</p>

        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {heroCategories.map((key) => {
            const meta = CATEGORY_META[key]
            return (
              <Link
                key={key}
                href={`/book?category=${key}`}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-white/10 px-2 py-3 text-center transition hover:bg-white/20"
              >
                <span className="text-2xl">{meta?.icon}</span>
                <span className="text-xs font-medium text-white">{meta?.label}</span>
              </Link>
            )
          })}
        </div>

        <Link
          href="/book"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/30 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
        >
          View all services →
        </Link>
      </div>

      {/* ── Quick stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([['Pending', pending], ['Upcoming', upcoming], ['Total Bookings', bookings.length]] as const).map(([label, count]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{count}</p>
          </div>
        ))}
      </div>

      {/* ── Recent bookings ─────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
          <Link href="/bookings" className="text-sm text-primary hover:underline">View all →</Link>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
        ) : bookings.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <div className="text-center">
              <p className="text-gray-400">No bookings yet</p>
              <Link href="/book" className="mt-2 block text-sm text-primary hover:underline">Book your first service</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => (
              <Link
                key={b.id}
                href={'/bookings/' + b.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300"
              >
                <div>
                  <p className="font-medium text-gray-900">{b.service?.title ?? b.booking_number}</p>
                  <p className="text-sm text-gray-500">{formatDate(b.scheduled_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(b.total_amount / 100)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
