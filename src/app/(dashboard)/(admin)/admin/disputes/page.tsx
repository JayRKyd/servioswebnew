'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, Lock, RefreshCw, Search, ShieldAlert } from 'lucide-react'

interface Row {
  id: string; number: string; status: string; priority: string | null; source: string; type: string
  desiredOutcome: string | null; desiredAmount: number | null; held: number; refunded: number | null
  resolutionType: string | null; filedAt: string; updatedAt: string | null; resolvedAt: string | null
  providerResponded: boolean; customerName: string; providerName: string
  booking: { id: string; number: string | null; total: number; service: string | null } | null
}

const TYPE: Record<string, string> = {
  not_completed: 'Work not finished', poor_quality: 'Poor quality', damage: 'Damage', no_show: 'No-show',
  overcharged: 'Overcharged', problem_after: 'Problem after job', other: 'Other', chargeback: 'Bank chargeback',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'New', cls: 'bg-red-50 text-red-700 ring-red-200' },
  under_review: { label: 'Reviewing', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  awaiting_customer: { label: 'Awaiting customer', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  awaiting_provider: { label: 'Awaiting provider', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  resolved: { label: 'Resolved', cls: 'bg-green-50 text-green-700 ring-green-200' },
  closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
}
const DEFAULT_STATUS = { label: 'Open', cls: 'bg-gray-100 text-gray-600 ring-gray-200' }
const RESOLUTION: Record<string, string> = {
  full_refund: 'Full refund', partial_refund: 'Partial refund', release_to_provider: 'Released to provider',
  no_action: 'No action', chargeback_won: 'Chargeback won', chargeback_lost: 'Chargeback lost',
}
const pounds = (p: number | null | undefined) => `£${((p ?? 0) / 100).toFixed(2)}`

function age(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AdminDisputesPage() {
  const [tab, setTab] = useState<'open' | 'resolved' | 'all'>('open')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async (t: typeof tab) => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/admin/disputes?status=${t}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load disputes (${res.status})`)
    else setRows(json.disputes ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load(tab) }, [tab, load])

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r => [r.number, r.customerName, r.providerName, r.booking?.number, r.booking?.service].some(v => v?.toLowerCase().includes(s)))
  }, [rows, q])

  const openCount = tab === 'open' ? rows.length : null
  const needsAction = rows.filter(r => r.status === 'open').length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? 'Loading…' : tab === 'open'
              ? `${openCount} open${needsAction ? ` · ${needsAction} not yet picked up` : ''}`
              : `${rows.length} ${tab === 'resolved' ? 'resolved' : 'total'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(['open', 'resolved', 'all'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>{t}</button>
            ))}
          </div>
          <button onClick={() => load(tab)} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search case, name, booking…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={15} /> {error}</div>}

      {!loading && visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <ShieldAlert size={28} className="text-gray-300" />
          <p className="text-sm text-gray-400">{tab === 'open' ? 'No open disputes — nothing needs attention.' : 'No disputes match.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(r => {
            const s = STATUS[r.status] ?? DEFAULT_STATUS
            const urgent = r.priority === 'urgent' || r.source === 'chargeback'
            return (
              <Link key={r.id} href={`/admin/disputes/${r.id}`}
                className={`group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 transition-all hover:shadow-sm ${urgent && r.status !== 'resolved' ? 'ring-red-200' : 'ring-gray-100 hover:ring-gray-300'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{r.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>
                    {urgent && r.status !== 'resolved' && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">{r.source === 'chargeback' ? 'Chargeback' : 'Urgent'}</span>}
                    {r.priority === 'high' && r.source !== 'chargeback' && r.status !== 'resolved' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Before confirmation</span>}
                    {!r.providerResponded && r.status !== 'resolved' && r.source !== 'chargeback' && <span className="text-[11px] text-gray-400">· provider hasn’t responded</span>}
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {TYPE[r.type] ?? r.type} — {r.booking?.service ?? 'Booking'}
                  </p>
                  <p className="truncate text-xs text-gray-500">{r.customerName} vs {r.providerName} · {r.booking?.number ?? ''} · filed {age(r.filedAt)}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-semibold text-gray-900">{pounds(r.booking?.total)}</p>
                  {r.status === 'resolved' || r.status === 'closed' ? (
                    <p className="text-xs text-gray-500">{RESOLUTION[r.resolutionType ?? ''] ?? 'Closed'}{r.refunded ? ` · ${pounds(r.refunded)}` : ''}</p>
                  ) : r.held > 0 ? (
                    <p className="inline-flex items-center gap-1 text-xs text-amber-700"><Lock size={11} /> {pounds(r.held)} held</p>
                  ) : (
                    <p className="text-xs text-gray-400">{r.desiredOutcome === 'partial_refund' && r.desiredAmount ? `wants ${pounds(r.desiredAmount)} back` : r.desiredOutcome?.replace('_', ' ') ?? ''}</p>
                  )}
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
