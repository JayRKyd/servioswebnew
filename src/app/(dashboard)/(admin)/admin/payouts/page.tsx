'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronUp, Clock, Landmark, Lock, RefreshCw, Search, Wallet } from 'lucide-react'

type PayoutState = 'held' | 'owed' | 'clearing' | 'paid_out' | 'refunded'
interface Row {
  paymentId: string; bookingId: string; bookingNumber: string | null; service: string | null; customerName: string
  scheduledDate: string | null; capturedAt: string | null; gross: number; refunded: number; commission: number; net: number
  held: number; transferred: number; releasedAt: string | null; payoutMethod: string | null; payoutReference: string | null
  clearsOn: string | null; state: PayoutState; disputeNumber: string | null
}
interface Provider {
  profileId: string; userId: string; name: string; email: string | null; avatarUrl: string | null
  connect: 'active' | 'pending' | 'restricted' | 'not_connected'; payoutDelayDays: number
  owed: number; held: number; clearing: number; paidOut: number; payments: Row[]
}
interface Data { providers: Provider[]; totals: { owed: number; held: number; clearing: number; paidOut: number; commission: number } }

const pounds = (p: number) => `£${(p / 100).toFixed(2)}`
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const STATE: Record<PayoutState, { label: string; cls: string; icon: React.ElementType }> = {
  owed:     { label: 'Owed', cls: 'bg-blue-50 text-blue-700', icon: Banknote },
  held:     { label: 'On hold', cls: 'bg-red-50 text-red-700', icon: Lock },
  clearing: { label: 'Clearing', cls: 'bg-amber-50 text-amber-700', icon: Clock },
  paid_out: { label: 'Paid out', cls: 'bg-green-50 text-green-700', icon: Landmark },
  refunded: { label: 'Refunded', cls: 'bg-gray-100 text-gray-600', icon: Banknote },
}
const CONNECT: Record<Provider['connect'], { label: string; cls: string }> = {
  active: { label: 'Bank connected', cls: 'bg-green-50 text-green-700 ring-green-200' },
  pending: { label: 'Bank setup incomplete', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  restricted: { label: 'Stripe restricted', cls: 'bg-red-50 text-red-700 ring-red-200' },
  not_connected: { label: 'Paid manually', cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [onlyOwed, setOnlyOwed] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/payouts', { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`)
    else setData(json)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t) }, [toast])

  const providers = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data?.providers ?? [])
      .filter(p => !onlyOwed || p.owed > 0 || p.held > 0)
      .filter(p => !s || p.name.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s) || p.payments.some(r => r.bookingNumber?.toLowerCase().includes(s) || r.customerName.toLowerCase().includes(s)))
  }, [data, q, onlyOwed])

  const selectedIds = Object.keys(selected).filter(k => selected[k])
  const selectedTotal = (data?.providers ?? []).flatMap(p => p.payments).filter(r => selected[r.paymentId]).reduce((n, r) => n + Math.max(0, r.net - r.held), 0)

  async function release(method: 'manual' | 'stripe', ids: string[]) {
    if (!ids.length) return
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentIds: ids, method, reference }) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Release failed')
    else {
      const done = json.results.filter((r: any) => !r.outcome.startsWith('skipped')).length
      const skipped = json.results.filter((r: any) => r.outcome.startsWith('skipped')).map((r: any) => r.outcome).join('; ')
      setToast(`${done} payment${done === 1 ? '' : 's'} ${method === 'manual' ? 'recorded as paid out' : 'released via Stripe'}${skipped ? ` · ${skipped}` : ''}.`)
      setSelected({}); setReference('')
      await load()
    }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="mt-0.5 text-sm text-gray-500">What providers are owed from captured payments, what’s on hold, and what has reached them.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Owed to providers" value={data.totals.owed} icon={Banknote} tone="blue" hint="captured, not yet paid" />
          <Stat label="On hold" value={data.totals.held} icon={Lock} tone="red" hint="open disputes" />
          <Stat label="Clearing" value={data.totals.clearing} icon={Clock} tone="amber" hint="in Stripe, bank date ahead" />
          <Stat label="Paid out" value={data.totals.paidOut} icon={Landmark} tone="green" hint="reached providers" />
          <Stat label="Servios commission" value={data.totals.commission} icon={Wallet} tone="gray" hint="on all captured payments" />
        </div>
      )}

      {toast && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {toast}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search provider, customer, booking…" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={onlyOwed} onChange={e => setOnlyOwed(e.target.checked)} className="accent-[#115e56]" /> Only providers owed money</label>
      </div>

      {/* Batch release bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-white p-3 shadow-md">
          <p className="text-sm font-semibold text-gray-900">{selectedIds.length} payment{selectedIds.length === 1 ? '' : 's'} · {pounds(selectedTotal)}</p>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank transfer reference (required)" className="min-w-[220px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button disabled={busy || !reference.trim()} onClick={() => release('manual', selectedIds)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">{busy ? 'Saving…' : 'Record as paid out'}</button>
          <button disabled={busy} onClick={() => setSelected({})} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Clear</button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Wallet size={28} className="text-gray-300" />
          <p className="text-sm text-gray-400">{onlyOwed ? 'Nobody is owed anything right now.' : 'No captured payments yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => {
            const expanded = open === p.profileId
            const c = CONNECT[p.connect]
            const owedIds = p.payments.filter(r => r.state === 'owed').map(r => r.paymentId)
            return (
              <div key={p.profileId} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <button onClick={() => setOpen(expanded ? null : p.profileId)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/60">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{p.name.charAt(0)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{p.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.cls}`}>{c.label}</span>
                      {p.connect === 'active' && <span className="text-[11px] text-gray-400">{p.payoutDelayDays}-day clearing</span>}
                    </div>
                    <p className="truncate text-xs text-gray-500">{p.email ?? ''} · {p.payments.length} payment{p.payments.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="hidden gap-6 text-right sm:flex">
                    <Amount label="Owed" value={p.owed} strong />
                    {p.held > 0 && <Amount label="Held" value={p.held} tone="text-red-600" />}
                    {p.clearing > 0 && <Amount label="Clearing" value={p.clearing} tone="text-amber-700" />}
                    <Amount label="Paid out" value={p.paidOut} tone="text-gray-500" />
                  </div>
                  {expanded ? <ChevronUp size={16} className="shrink-0 text-gray-400" /> : <ChevronDown size={16} className="shrink-0 text-gray-400" />}
                </button>

                {expanded && (
                  <div className="border-t border-gray-100">
                    {owedIds.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/60 px-5 py-2.5 text-xs text-blue-900">
                        <span>{owedIds.length} payment{owedIds.length === 1 ? '' : 's'} owed · {pounds(p.owed)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setSelected(s => ({ ...s, ...Object.fromEntries(owedIds.map(id => [id, true])) }))} className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 font-semibold hover:bg-blue-50">Select all owed</button>
                          {p.connect === 'active' && <button disabled={busy} onClick={() => release('stripe', owedIds)} className="rounded-lg bg-blue-700 px-2.5 py-1 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Transfer via Stripe</button>}
                        </div>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          <th className="w-8 px-5 py-2" />
                          <th className="px-3 py-2">Job</th>
                          <th className="hidden px-3 py-2 md:table-cell">Captured</th>
                          <th className="px-3 py-2 text-right">Net</th>
                          <th className="hidden px-3 py-2 text-right lg:table-cell">Gross / refund / fee</th>
                          <th className="px-5 py-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {p.payments.map(r => {
                          const s = STATE[r.state]; const Icon = s.icon
                          const selectable = r.state === 'owed'
                          return (
                            <tr key={r.paymentId} className={selected[r.paymentId] ? 'bg-primary/[0.04]' : ''}>
                              <td className="px-5 py-3">{selectable && <input type="checkbox" checked={!!selected[r.paymentId]} onChange={e => setSelected(sl => ({ ...sl, [r.paymentId]: e.target.checked }))} className="accent-[#115e56]" />}</td>
                              <td className="px-3 py-3">
                                <Link href={`/admin/bookings/${r.bookingId}`} className="font-medium text-gray-900 hover:text-primary">{r.service ?? 'Booking'}</Link>
                                <p className="text-xs text-gray-500">{r.customerName} · <span className="font-mono">{r.bookingNumber}</span></p>
                              </td>
                              <td className="hidden px-3 py-3 text-gray-500 md:table-cell">{day(r.capturedAt)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-900">{pounds(r.net)}</td>
                              <td className="hidden px-3 py-3 text-right text-xs text-gray-500 lg:table-cell">{pounds(r.gross)}{r.refunded ? ` − ${pounds(r.refunded)}` : ''} − {pounds(r.commission)}</td>
                              <td className="px-5 py-3 text-right">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}><Icon size={11} /> {s.label}</span>
                                <p className="mt-0.5 text-[11px] text-gray-400">
                                  {r.state === 'held' && r.disputeNumber ? <Link href="/admin/disputes" className="hover:underline">{pounds(r.held)} · {r.disputeNumber}</Link>
                                    : r.state === 'clearing' ? `bank ${day(r.clearsOn)}`
                                    : r.state === 'paid_out' ? (r.payoutMethod === 'manual' ? `ref ${r.payoutReference ?? '—'} · ${day(r.releasedAt)}` : `Stripe · ${day(r.releasedAt)}`)
                                    : ''}
                                </p>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon: Icon, tone, hint }: { label: string; value: number; icon: React.ElementType; tone: 'blue' | 'amber' | 'red' | 'green' | 'gray'; hint: string }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-600', gray: 'bg-gray-100 text-gray-600' }
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p><div className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon size={13} /></div></div>
      <p className="text-2xl font-bold tracking-tight text-gray-900">{pounds(value)}</p>
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </div>
  )
}

function Amount({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-sm ${strong ? 'font-bold text-gray-900' : `font-medium ${tone ?? 'text-gray-700'}`}`}>{pounds(value)}</p>
    </div>
  )
}
