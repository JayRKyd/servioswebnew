'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate, formatCurrency, titleCase } from '@/lib/utils'
import { TrendingUp, Briefcase, PoundSterling, Lock, Clock, ArrowUpRight, Banknote, Landmark } from 'lucide-react'

/**
 * Earnings are read from the payments table — what the customer actually
 * paid and what the provider is owed after refunds — not from booking rows.
 * A job the provider marked complete but the customer never paid for is not
 * income (Round 6 blocker 3).
 */

const PERIODS = [
  { label: 'This month', value: 'month' },
  { label: 'Last 3 months', value: '3months' },
  { label: 'This year', value: 'year' },
  { label: 'All time', value: 'all' },
]

type PayoutState = 'owed' | 'clearing' | 'held' | 'paid_out' | 'refunded'

interface Row {
  id: string
  bookingId: string
  service: string
  customerName: string
  customerAvatar: string | null
  date: string | null
  capturedAt: string | null
  gross: number
  refunded: number
  commission: number
  net: number
  held: number
  transferred: number
  paidOutManually: boolean
  state: PayoutState
  clearsOn: Date | null
  isEmergency: boolean
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const STATE_META: Record<PayoutState, { label: string; cls: string; icon: React.ElementType }> = {
  owed:      { label: 'Owed to you', cls: 'bg-blue-50 text-blue-700', icon: Banknote },
  clearing:  { label: 'Clearing', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  held:      { label: 'On hold', cls: 'bg-red-50 text-red-700', icon: Lock },
  paid_out:  { label: 'Paid out', cls: 'bg-green-50 text-green-700', icon: Landmark },
  refunded:  { label: 'Refunded', cls: 'bg-gray-100 text-gray-600', icon: Banknote },
}

export default function ProviderEarningsPage() {
  const { providerId } = useProfileIds()
  const [rows, setRows] = useState<Row[]>([])
  const [awaiting, setAwaiting] = useState<{ id: string; service: string; customerName: string; date: string | null; amount: number; status: string }[]>([])
  const [profile, setProfile] = useState<{ stripe_account_status: string | null; payout_delay_days: number | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    if (!providerId) return
    async function load() {
      const [{ data: pp }, { data: payments }, { data: unpaid }, { data: { user } }] = await Promise.all([
        supabase.from('provider_profiles').select('stripe_account_status, payout_delay_days').eq('id', providerId).maybeSingle(),
        supabase.from('payments')
          .select('id, booking_id, amount, refund_amount, platform_fee_amount, provider_payout_amount, payment_status, captured_at, released_at, payout_method, transferred_amount, reversed_amount, booking:bookings!inner(id, provider_id, scheduled_date, is_emergency, service:services(title), customer_profile:customer_profiles(first_name, last_name, profile_image_url))')
          .eq('booking.provider_id', providerId)
          .in('payment_status', ['succeeded', 'partially_refunded', 'refunded'])
          .order('captured_at', { ascending: false }),
        supabase.from('bookings')
          .select('id, status, scheduled_date, total_amount, payment_status, service:services(title), customer_profile:customer_profiles(first_name, last_name)')
          .eq('provider_id', providerId)
          .in('status', ['accepted', 'in_progress', 'completed'])
          .not('payment_status', 'in', '("paid","partially_refunded","refunded")')
          .gt('total_amount', 0)
          .order('scheduled_date', { ascending: false }),
        supabase.auth.getUser(),
      ])
      setProfile(pp ?? null)

      // Open-dispute holds are against this provider's user id
      const { data: holds } = user
        ? await supabase.from('disputes').select('booking_id, held_amount').eq('filed_against', user.id).in('status', ['open', 'under_review', 'awaiting_customer', 'awaiting_provider'])
        : { data: [] as any[] }
      const heldByBooking: Record<string, number> = {}
      for (const h of holds ?? []) heldByBooking[h.booking_id] = (heldByBooking[h.booking_id] ?? 0) + Number(h.held_amount ?? 0)

      const connected = pp?.stripe_account_status === 'active'
      const delayDays = Number(pp?.payout_delay_days ?? 7)

      setRows((payments ?? []).map((p: any) => {
        const b = p.booking
        const cp = b?.customer_profile
        const gross = Number(p.amount ?? 0)
        const refunded = Number(p.refund_amount ?? 0)
        const commission = Number(p.platform_fee_amount ?? 0)
        const net = Number(p.provider_payout_amount ?? gross - refunded - commission)
        const held = heldByBooking[p.booking_id] ?? 0
        const transferred = Number(p.transferred_amount ?? 0) - Number(p.reversed_amount ?? 0)
        const paidOutManually = !!p.payout_method && p.payout_method !== 'stripe'
        const clearsOn = p.captured_at ? new Date(new Date(p.captured_at).getTime() + delayDays * 86_400_000) : null
        let state: PayoutState
        if (net <= 0 && refunded >= gross) state = 'refunded'
        else if (held > 0) state = 'held'
        else if (paidOutManually) state = 'paid_out'
        else if (connected && transferred > 0) state = clearsOn && clearsOn.getTime() > Date.now() ? 'clearing' : 'paid_out'
        else state = 'owed'
        return {
          id: p.id, bookingId: p.booking_id,
          service: b?.service?.title ?? 'Booking',
          customerName: cp ? `${titleCase(cp.first_name ?? '')} ${titleCase(cp.last_name ?? '')}`.trim() : 'Customer',
          customerAvatar: cp?.profile_image_url ?? null,
          date: b?.scheduled_date ?? null, capturedAt: p.captured_at ?? null,
          gross, refunded, commission, net, held, transferred, paidOutManually, state, clearsOn,
          isEmergency: !!b?.is_emergency,
        }
      }))
      setAwaiting((unpaid ?? []).map((b: any) => ({
        id: b.id, service: b.service?.title ?? 'Booking', status: b.status,
        customerName: b.customer_profile ? `${titleCase(b.customer_profile.first_name ?? '')} ${titleCase(b.customer_profile.last_name ?? '')}`.trim() : 'Customer',
        date: b.scheduled_date ?? null, amount: Number(b.total_amount ?? 0),
      })))
      setLoading(false)
    }
    load()
  }, [providerId])

  const now = new Date()
  const inPeriod = (iso: string | null) => {
    if (!iso) return false
    const d = new Date(iso)
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === '3months') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1)
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  }
  const filtered = useMemo(() => rows.filter(r => inPeriod(r.capturedAt)), [rows, period]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const t = { net: 0, gross: 0, commission: 0, refunded: 0, owed: 0, clearing: 0, held: 0, paidOut: 0 }
    for (const r of rows) {
      if (r.state === 'held') t.held += r.held
      const free = r.net - (r.state === 'held' ? r.held : 0)
      if (r.state === 'owed' || r.state === 'held') t.owed += Math.max(0, free)
      if (r.state === 'clearing') t.clearing += r.net
      if (r.state === 'paid_out') t.paidOut += r.net
    }
    for (const r of filtered) { t.net += r.net; t.gross += r.gross; t.commission += r.commission; t.refunded += r.refunded }
    return t
  }, [rows, filtered])

  const monthNet = rows.filter(r => r.capturedAt && new Date(r.capturedAt).getMonth() === now.getMonth() && new Date(r.capturedAt).getFullYear() === now.getFullYear()).reduce((s, r) => s + r.net, 0)
  const bars = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = monthKey(d)
    const val = rows.filter(r => r.capturedAt && monthKey(new Date(r.capturedAt)) === key).reduce((s, r) => s + r.net, 0)
    return { key, label: d.toLocaleDateString('en-GB', { month: 'short' }), val }
  }), [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxBar = Math.max(...bars.map(b => b.val), 1)
  const connected = profile?.stripe_account_status === 'active'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-0.5 text-sm text-gray-400">What customers have paid, after Servios commission</p>
        </div>
        <div className="flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${period === p.value ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Balance: where the money is ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-primary to-primary/75 p-5 text-white shadow-sm lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Net this month</p>
            <div className="rounded-lg bg-white/15 p-1.5"><TrendingUp size={14} /></div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{formatCurrency(monthNet / 100)}</p>
          <p className="mt-1.5 text-xs text-white/60">from jobs customers paid for this month</p>
        </div>
        <Stat label={connected ? 'Owed to you' : 'Owed to you'} value={totals.owed} icon={Banknote} tone="blue"
          hint={connected ? 'captured, not yet transferred' : 'paid out by the Servios team'} />
        <Stat label={connected ? 'Clearing to bank' : 'On hold'} value={connected ? totals.clearing : totals.held} icon={connected ? Clock : Lock} tone={connected ? 'amber' : 'red'}
          hint={connected ? `${profile?.payout_delay_days ?? 7}-day clearing period` : 'open problem reports'} />
        <Stat label="Paid out" value={totals.paidOut} icon={Landmark} tone="green" hint={connected ? 'in your bank' : 'by the Servios team'} />
      </div>

      {totals.held > 0 && connected && (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><Lock size={14} /> {formatCurrency(totals.held / 100)} is on hold for open problem reports.</p>
      )}

      {!connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-sm text-gray-600">Your bank isn’t connected, so the Servios team pays you out. Connect it to receive payments automatically {profile?.payout_delay_days ?? 7} days after each job is confirmed.</p>
          <Link href="/provider/payouts" className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white hover:bg-primary-dark">Connect bank account</Link>
        </div>
      )}

      {/* ── Awaiting payment — not income yet ── */}
      {awaiting.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Awaiting customer payment</p>
          <ul className="mt-2 divide-y divide-amber-100">
            {awaiting.map(b => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/provider/bookings/${b.id}`} className="min-w-0 truncate font-medium text-gray-900 hover:text-primary">{b.service} <span className="font-normal text-gray-500">· {b.customerName}{b.date ? ` · ${formatDate(b.date)}` : ''}</span></Link>
                <span className="shrink-0 text-xs text-amber-800">{formatCurrency(b.amount / 100)} not yet authorised</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 6-month chart ── */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <p className="mb-1 text-sm font-semibold text-gray-900">Monthly earnings — last 6 months</p>
        <p className="mb-5 text-xs text-gray-400">Net after commission and refunds, by the month the customer paid</p>
        <div className="mb-1 flex gap-3">{bars.map(b => <div key={b.key} className="flex-1 text-center"><span className="whitespace-nowrap text-[10px] font-medium text-gray-400">{b.val > 0 ? formatCurrency(b.val / 100) : ''}</span></div>)}</div>
        <div className="flex items-end gap-3" style={{ height: '80px' }}>
          {bars.map(b => {
            const barH = b.val > 0 ? Math.max(Math.round((b.val / maxBar) * 80), 6) : 3
            const isCurrent = b.key === monthKey(now)
            return <div key={b.key} className="flex flex-1 items-end justify-center" style={{ height: '80px' }}><div className={`w-full rounded-t-lg ${isCurrent ? 'bg-primary' : 'bg-primary/20'} ${b.val === 0 ? 'opacity-20' : ''}`} style={{ height: `${barH}px` }} /></div>
          })}
        </div>
        <div className="mt-2 flex gap-3">{bars.map(b => <div key={b.key} className="flex-1 text-center"><span className={`text-xs font-semibold ${b.key === monthKey(now) ? 'text-primary' : 'text-gray-400'}`}>{b.label}</span></div>)}</div>
      </div>

      {/* ── Transactions ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payments received</h2>
          <p className="text-xs text-gray-400">{filtered.length} in period · {formatCurrency(totals.net / 100)} net</p>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-100"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200">
            <Briefcase size={22} className="text-gray-300" />
            <p className="text-sm text-gray-400">No payments received in this period</p>
            <p className="text-xs text-gray-300">A job counts here once the customer has confirmed it and paid</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-3.5">Job</th>
                  <th className="hidden px-5 py-3.5 md:table-cell">Customer</th>
                  <th className="hidden px-5 py-3.5 md:table-cell">Paid</th>
                  <th className="px-5 py-3.5 text-right">Gross</th>
                  <th className="hidden px-5 py-3.5 text-right lg:table-cell">Refunded</th>
                  <th className="hidden px-5 py-3.5 text-right lg:table-cell">Commission</th>
                  <th className="px-5 py-3.5 text-right">Net</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const meta = STATE_META[r.state]
                  const Icon = meta.icon
                  const initials = r.customerName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <Link href={`/provider/bookings/${r.bookingId}`} className="group/link flex items-center gap-1.5 font-semibold text-gray-900">
                          {r.service} <ArrowUpRight size={12} className="text-gray-300 group-hover/link:text-primary" />
                        </Link>
                        <p className="text-xs text-gray-400 md:hidden">{r.customerName}{r.capturedAt ? ` · ${formatDate(r.capturedAt)}` : ''}</p>
                        {r.isEmergency && <span className="mt-0.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">Emergency</span>}
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {r.customerAvatar ? <img src={r.customerAvatar} alt="" className="h-7 w-7 object-cover" /> : initials}
                          </div>
                          <span className="text-gray-600">{r.customerName}</span>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 text-gray-400 md:table-cell">{r.capturedAt ? formatDate(r.capturedAt) : '—'}</td>
                      <td className="px-5 py-4 text-right font-medium text-gray-700">{formatCurrency(r.gross / 100)}</td>
                      <td className="hidden px-5 py-4 text-right text-gray-500 lg:table-cell">{r.refunded > 0 ? `−${formatCurrency(r.refunded / 100)}` : '—'}</td>
                      <td className="hidden px-5 py-4 text-right text-red-500 lg:table-cell">−{formatCurrency(r.commission / 100)}</td>
                      <td className="px-5 py-4 text-right"><span className="rounded-full bg-green-50 px-3 py-1 text-sm font-bold text-green-700">{formatCurrency(r.net / 100)}</span></td>
                      <td className="px-5 py-4 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}><Icon size={11} /> {meta.label}</span>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {r.state === 'held' ? `${formatCurrency(r.held / 100)} held`
                            : r.state === 'clearing' && r.clearsOn ? `bank ${r.clearsOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                            : r.state === 'owed' && !connected ? 'via Servios team'
                            : r.state === 'paid_out' && r.paidOutManually ? 'by Servios team' : ''}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/80 text-sm font-bold">
                  <td colSpan={3} className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Period total</td>
                  <td className="px-5 py-4 text-right text-gray-700">{formatCurrency(totals.gross / 100)}</td>
                  <td className="hidden px-5 py-4 text-right text-gray-500 lg:table-cell">{totals.refunded > 0 ? `−${formatCurrency(totals.refunded / 100)}` : '—'}</td>
                  <td className="hidden px-5 py-4 text-right text-red-500 lg:table-cell">−{formatCurrency(totals.commission / 100)}</td>
                  <td className="px-5 py-4 text-right"><span className="rounded-full bg-green-100 px-3 py-1 text-green-800">{formatCurrency(totals.net / 100)}</span></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, icon: Icon, tone, hint }: { label: string; value: number; icon: React.ElementType; tone: 'blue' | 'amber' | 'red' | 'green'; hint: string }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-600' }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <div className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon size={14} /></div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(value / 100)}</p>
      <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
    </div>
  )
}
