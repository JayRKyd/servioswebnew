'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'

interface Row {
  id: string; number: string; status: string; paymentStatus: string | null; date: string | null; time: string | null
  total: number; fee: number; confirmedAt: string | null; createdAt: string; emergency: boolean; service: string | null
  customer: { userId: string; name: string } | null; provider: { userId: string; name: string } | null; openDispute: string | null
}
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`
const day = (iso: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const PAY: Record<string, string> = { unpaid: 'bg-gray-100 text-gray-600', pending: 'bg-gray-100 text-gray-600', authorized: 'bg-blue-50 text-blue-700', paid: 'bg-green-50 text-green-700', partially_refunded: 'bg-amber-50 text-amber-700', refunded: 'bg-gray-200 text-gray-700', failed: 'bg-red-50 text-red-700' }

export default function AdminBookingsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/admin/bookings?status=${status}&payment=${payment}&q=${encodeURIComponent(q)}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`); else setRows(json.bookings ?? [])
    setLoading(false)
  }, [status, payment, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-0.5 text-sm text-gray-500">{loading ? 'Loading…' : `${rows.length} booking${rows.length === 1 ? '' : 's'}`}</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Booking reference…" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          {['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'].map(s => <option key={s} value={s}>{s === 'all' ? 'Any status' : s.replace('_', ' ')}</option>)}
        </select>
        <select value={payment} onChange={e => setPayment(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
          {['all', 'unpaid', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed'].map(s => <option key={s} value={s}>{s === 'all' ? 'Any payment' : s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={15} /> {error}</div>}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-4 py-3">Booking</th>
              <th className="hidden px-4 py-3 md:table-cell">Customer</th>
              <th className="hidden px-4 py-3 md:table-cell">Provider</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 lg:table-cell">Payment</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">No bookings match.</td></tr>}
            {rows.map(b => (
              <tr key={b.id} className="group hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-gray-900 group-hover:text-primary">{b.service ?? 'Booking'}</Link>
                  <p className="font-mono text-[11px] text-gray-400">{b.number}{b.emergency ? ' · emergency' : ''}</p>
                  {b.openDispute && <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"><ShieldAlert size={10} /> {b.openDispute}</span>}
                </td>
                <td className="hidden px-4 py-3 text-gray-700 md:table-cell">{b.customer?.name || '—'}</td>
                <td className="hidden px-4 py-3 text-gray-700 md:table-cell">{b.provider?.name || <span className="text-gray-400">unassigned</span>}</td>
                <td className="px-4 py-3 text-gray-500">{day(b.date)}{b.time ? <span className="text-gray-400"> {String(b.time).slice(0, 5)}</span> : null}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="hidden px-4 py-3 lg:table-cell"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PAY[b.paymentStatus ?? 'unpaid'] ?? PAY.unpaid}`}>{(b.paymentStatus ?? 'unpaid').replace('_', ' ')}</span>{b.confirmedAt && <p className="mt-0.5 text-[10px] text-gray-400">confirmed {day(b.confirmedAt)}</p>}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{pounds(b.total)}</td>
                <td className="pr-3"><Link href={`/admin/bookings/${b.id}`} aria-label="Open"><ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
