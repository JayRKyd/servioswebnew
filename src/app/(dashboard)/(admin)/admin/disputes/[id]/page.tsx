'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Clock, EyeOff, FileText, Lock,
  Mail, MessageSquare, Phone, Scale, Star, Users,
} from 'lucide-react'

/* ─── Types (mirror loadDisputeView) ─── */
interface FileRef { path: string; url: string | null; kind: 'image' | 'pdf' | 'file' }
interface Person {
  userId: string; name: string; email: string | null; phone: string | null; avatarUrl: string | null; joinedAt: string | null
  provider: { profileId: string; rating: number | null; reviews: number; jobs: number; verification: string } | null
}
interface Preview { original: number; alreadyRefunded: number; refund: number; customerPays: number; providerGets: number; serviosKeeps: number }
interface AdminView {
  dispute: {
    id: string; number: string; status: string; open: boolean; source: string; type: string; reason: string
    desiredOutcome: string | null; desiredAmount: number | null; providerResponse: string | null; providerRespondedAt: string | null
    resolutionType: string | null; resolutionNotes: string | null; refundAmount: number | null
    filedAt: string; resolvedAt: string | null; evidence: FileRef[]
  }
  booking: { id: string; number: string | null; status: string; service: string | null; scheduledDate: string | null; total: number; confirmedAt: string | null } | null
  customer: Person | null
  provider: Person | null
  thread: { id: string; role: string; senderName: string; body: string; visibleTo: string; createdAt: string; attachments: FileRef[] }[]
  chat: { id: string; senderName: string; body: string; createdAt: string; fromCustomer: boolean }[]
  conversationId: string | null
  photos: { id: string; type: string; url: string | null; by: string; createdAt: string }[]
  payment: { id: string; status: string; method: string | null; amount: number; refunded: number; commission: number; providerShare: number; transferred: number; held: number; simulated: boolean; intentId: string | null } | null
  rate: number
  previews: { full_refund: Preview | null; release_to_provider: Preview | null }
  audit: { id: string; action: string; reason: string | null; created_at: string }[]
  priority: string | null
  stripeDisputeId: string | null
}

const TYPE: Record<string, string> = {
  not_completed: 'Work not finished', poor_quality: 'Poor quality work', damage: 'Damage to property', no_show: 'Provider didn’t turn up',
  overcharged: 'Charged more than agreed', problem_after: 'Problem appeared after the job', other: 'Something else', chargeback: 'Bank chargeback',
}
const OUTCOME: Record<string, string> = { full_refund: 'Full refund', partial_refund: 'Partial refund', redo: 'Provider to put it right', other: 'Something else' }
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
  full_refund: 'Full refund to customer', partial_refund: 'Partial refund to customer', release_to_provider: 'Released to provider',
  no_action: 'Closed — no change to payment', chargeback_won: 'Bank ruled for Servios', chargeback_lost: 'Bank ruled for the customer',
}
const VISIBILITY = [
  { value: 'all', label: 'Both sides', icon: Users },
  { value: 'customer', label: 'Customer only', icon: Users },
  { value: 'provider', label: 'Provider only', icon: Users },
  { value: 'admin', label: 'Internal note', icon: EyeOff },
] as const

const pounds = (p: number | null | undefined) => `£${((p ?? 0) / 100).toFixed(2)}`
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

async function api(path: string, method: 'POST' | 'PATCH', body: unknown) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json
}

function Avatar({ p, size = 40 }: { p: Person | null; size?: number }) {
  if (p?.avatarUrl) return <img src={p.avatarUrl} alt={p.name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-1 ring-gray-200" />
  return <div style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{(p?.name ?? '?').charAt(0).toUpperCase()}</div>
}

function Files({ files }: { files: FileRef[] }) {
  if (!files.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map(f => f.url && f.kind === 'image' ? (
        <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg ring-1 ring-gray-200 hover:ring-primary">
          <img src={f.url} alt="Evidence" className="h-full w-full object-cover" />
        </a>
      ) : (
        <a key={f.path} href={f.url ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <FileText size={13} /> {f.path.split('/').pop()?.replace(/^\d+-/, '')}
        </a>
      ))}
    </div>
  )
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function PersonCard({ label, p }: { label: string; p: Person | null }) {
  if (!p) return null
  return (
    <div className="flex items-start gap-3">
      <Avatar p={p} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="truncate text-sm font-semibold text-gray-900">{p.name}</p>
        {p.provider && (
          <p className="flex items-center gap-1 text-xs text-gray-500">
            {p.provider.rating ? <><Star size={11} className="fill-amber-400 text-amber-400" /> {p.provider.rating.toFixed(1)} ({p.provider.reviews}) · </> : null}
            {p.provider.jobs} jobs · {p.provider.verification}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {p.email && <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-gray-900"><Mail size={11} /> {p.email}</a>}
          {p.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {p.phone}</span>}
        </div>
      </div>
    </div>
  )
}

/* ─── Resolution panel ─── */
function ResolvePanel({ view, onDone }: { view: AdminView; onDone: (msg: string) => void }) {
  const p = view.payment
  const remaining = p ? p.amount - p.refunded : 0
  const canRefund = !!p && !['cancelled', 'failed', 'pending', 'refunded'].includes(p.status)
  const [outcome, setOutcome] = useState<'full_refund' | 'partial_refund' | 'release_to_provider' | 'no_action'>(canRefund ? 'partial_refund' : 'no_action')
  const [amount, setAmount] = useState(() => view.dispute.desiredOutcome === 'partial_refund' && view.dispute.desiredAmount ? (view.dispute.desiredAmount / 100).toFixed(2) : '')
  const [notes, setNotes] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountPence = outcome === 'partial_refund' ? Math.round(parseFloat(amount || '0') * 100) : null

  useEffect(() => {
    setConfirming(false)
    if (!p) { setPreview(null); return }
    const t = setTimeout(async () => {
      try {
        const json = await api(`/api/admin/disputes/${view.dispute.id}`, 'PATCH', { preview: { outcome, amountPence } })
        setPreview(json.preview)
      } catch { setPreview(null) }
    }, 250)
    return () => clearTimeout(t)
  }, [outcome, amountPence, p, view.dispute.id])

  async function submit() {
    setBusy(true); setError(null)
    try {
      await api(`/api/admin/disputes/${view.dispute.id}/resolve`, 'POST', { outcome, amountPence, notes })
      onDone(`Case ${view.dispute.number} resolved — ${RESOLUTION[outcome]}. Both sides have been emailed.`)
    } catch (e: any) {
      setError(e.message); setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  const options: { value: typeof outcome; label: string; hint: string; disabled?: boolean }[] = [
    { value: 'full_refund', label: 'Full refund', hint: p?.status === 'authorized' ? 'Release the card hold — nothing is charged' : `Refund ${pounds(remaining)} to the customer`, disabled: !canRefund && p?.status !== 'authorized' },
    { value: 'partial_refund', label: 'Partial refund', hint: 'Refund part; commission is taken only on what the provider keeps', disabled: !canRefund && p?.status !== 'authorized' },
    { value: 'release_to_provider', label: 'Release to provider', hint: p?.status === 'authorized' ? 'Charge the card and pay the provider in full' : 'Lift the hold — provider keeps their full share', disabled: !p },
    { value: 'no_action', label: 'Close, no money change', hint: 'Resolved between them, or no payment involved' },
  ]

  return (
    <Card title="Decide this case">
      <div className="space-y-4">
        <div className="space-y-2">
          {options.map(o => (
            <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${o.disabled ? 'cursor-not-allowed opacity-40' : outcome === o.value ? 'border-primary bg-primary/[0.04] ring-1 ring-primary' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="outcome" disabled={o.disabled} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="mt-0.5 accent-[#115e56]" />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
                <span className="block text-xs text-gray-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {outcome === 'partial_refund' && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Refund amount</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">£</span>
              <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00"
                className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <span className="text-xs text-gray-400">of {pounds(remaining)}{view.dispute.desiredAmount && view.dispute.desiredOutcome === 'partial_refund' ? ` · customer asked for ${pounds(view.dispute.desiredAmount)}` : ''}</span>
            </div>
          </div>
        )}

        {preview && (
          <div className="rounded-xl bg-gray-50 p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">After this decision</p>
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-gray-500">Customer refunded</dt><dd className="font-semibold text-gray-900">{pounds(preview.refund + preview.alreadyRefunded)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Customer pays</dt><dd className="text-gray-900">{pounds(preview.customerPays)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Provider gets</dt><dd className="font-semibold text-green-700">{pounds(preview.providerGets)}</dd></div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5"><dt className="text-gray-500">Servios commission ({Math.round(view.rate * 100)}% of what’s kept)</dt><dd className="text-gray-900">{pounds(preview.serviosKeeps)}</dd></div>
            </dl>
            {outcome !== 'release_to_provider' && outcome !== 'no_action' && preview.refund > 0 && (
              <p className="mt-2 text-[11px] text-gray-400">Stripe’s processing fee on the refunded part is absorbed by Servios.</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Decision note <span className="font-normal normal-case text-gray-400">(sent to both sides)</span></label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Photos show the tap still leaking after the visit. Refunding £40 for the unfinished part; the rest of the work was completed as agreed."
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {p?.simulated && <p className="text-[11px] text-amber-700">This booking was paid in simulation mode — no real money moves.</p>}

        {!confirming ? (
          <button onClick={() => setConfirming(true)} disabled={!notes.trim() || (outcome === 'partial_refund' && !(amountPence && amountPence > 0 && amountPence < remaining))}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            Resolve case
          </button>
        ) : (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
            <p className="text-sm font-semibold text-gray-900">{RESOLUTION[outcome]}{outcome === 'partial_refund' && amountPence ? ` — ${pounds(amountPence)}` : outcome === 'full_refund' ? ` — ${pounds(remaining)}` : ''}?</p>
            <p className="text-xs text-gray-600">This moves money immediately and can’t be undone from here. Both sides are emailed your note.</p>
            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">{busy ? 'Working…' : 'Confirm decision'}</button>
              <button onClick={() => setConfirming(false)} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-white">Back</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/* ─── Page ─── */
export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [view, setView] = useState<AdminView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [visibleTo, setVisibleTo] = useState<'all' | 'customer' | 'provider' | 'admin'>('all')
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/disputes/${id}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`)
    else { setView(json); setError(null) }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t) }, [toast])

  async function send() {
    if (!message.trim()) return
    setSending(true)
    try {
      await api(`/api/admin/disputes/${id}/messages`, 'POST', { body: message, visibleTo })
      setMessage('')
      setToast(visibleTo === 'admin' ? 'Internal note saved.' : `Message sent to ${visibleTo === 'all' ? 'both sides' : `the ${visibleTo}`} — they’ve been emailed.`)
      await load()
    } catch (e: any) { setError(e.message) } finally { setSending(false) }
  }

  async function setStatus(status: string) {
    setStatusBusy(true)
    try { await api(`/api/admin/disputes/${id}`, 'PATCH', { status }); await load() } catch (e: any) { setError(e.message) } finally { setStatusBusy(false) }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>
  if (!view) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Dispute not found'}</div>

  const d = view.dispute
  const s = STATUS[d.status] ?? DEFAULT_STATUS
  const p = view.payment

  return (
    <div className="space-y-5">
      <Link href="/admin/disputes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={14} /> All disputes</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{TYPE[d.type] ?? 'Dispute'}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>{s.label}</span>
            {d.source === 'chargeback' && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Bank chargeback</span>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            <span className="font-mono">{d.number}</span> · {view.booking?.service ?? 'Booking'} · {view.booking?.number} · filed {when(d.filedAt)}
          </p>
        </div>
        {d.open && (
          <div className="flex flex-wrap gap-1.5">
            {([['under_review', 'Reviewing'], ['awaiting_customer', 'Ask customer'], ['awaiting_provider', 'Ask provider']] as const).map(([st, label]) => (
              <button key={st} disabled={statusBusy || d.status === st} onClick={() => setStatus(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${d.status === st ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'} disabled:cursor-default`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {toast}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      {!d.open && d.resolutionType && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900"><Scale size={16} /> {RESOLUTION[d.resolutionType] ?? 'Resolved'}{d.refundAmount ? ` — ${pounds(d.refundAmount)}` : ''}</p>
          {d.resolutionNotes && <p className="mt-1 text-sm text-green-800">{d.resolutionNotes}</p>}
          {d.resolvedAt && <p className="mt-1 text-xs text-green-700">{when(d.resolvedAt)}</p>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* ── Left: the case ── */}
        <div className="space-y-5">
          <Card title="The report">
            <p className="text-xs text-gray-500">
              {d.source === 'chargeback' ? 'Raised by the customer’s bank' : `${view.customer?.name ?? 'Customer'} reported`}
              {d.desiredOutcome && d.source !== 'chargeback' && <> · wants <strong className="text-gray-800">{OUTCOME[d.desiredOutcome] ?? d.desiredOutcome}{d.desiredOutcome === 'partial_refund' && d.desiredAmount ? ` (${pounds(d.desiredAmount)})` : ''}</strong></>}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{d.reason}</p>
            <Files files={d.evidence} />
            {d.source !== 'chargeback' && (
              <div className={`mt-4 rounded-xl p-3.5 ${d.providerResponse ? 'bg-gray-50' : 'border border-dashed border-amber-300 bg-amber-50/50'}`}>
                <p className="text-xs font-semibold text-gray-500">Provider’s response{d.providerRespondedAt ? ` · ${when(d.providerRespondedAt)}` : ''}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{d.providerResponse ?? 'No response yet. Use “Ask provider” or message them below.'}</p>
              </div>
            )}
          </Card>

          <Card title="Case thread" right={<span className="text-xs text-gray-400">{view.thread.length} message{view.thread.length === 1 ? '' : 's'}</span>}>
            <div className="space-y-3">
              {view.thread.length === 0 && <p className="text-sm text-gray-400">No messages yet.</p>}
              {view.thread.map(m => m.role === 'system' ? (
                <p key={m.id} className="flex items-center justify-center gap-1.5 text-xs text-gray-400"><Clock size={11} /> {m.body} · {when(m.createdAt)}</p>
              ) : (
                <div key={m.id} className={`rounded-xl p-3.5 ${m.visibleTo === 'admin' ? 'bg-yellow-50 ring-1 ring-yellow-200' : m.role === 'admin' ? 'bg-primary/[0.06] ring-1 ring-primary/15' : m.role === 'customer' ? 'bg-gray-50' : 'bg-white ring-1 ring-gray-200'}`}>
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{m.senderName}</span>
                    <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-500">{m.role}</span>
                    {m.role === 'admin' && <span className="ml-1 text-[11px] text-gray-400">→ {m.visibleTo === 'all' ? 'both' : m.visibleTo === 'admin' ? 'internal' : m.visibleTo}</span>}
                    {' '}· {when(m.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{m.body}</p>
                  <Files files={m.attachments} />
                </div>
              ))}
            </div>

            {d.open && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {VISIBILITY.map(v => (
                    <button key={v.value} onClick={() => setVisibleTo(v.value)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${visibleTo === v.value ? (v.value === 'admin' ? 'bg-yellow-400 text-yellow-950' : 'bg-gray-900 text-white') : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {v.value === 'admin' ? <EyeOff size={11} /> : <MessageSquare size={11} />} {v.label}
                    </button>
                  ))}
                </div>
                <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
                  placeholder={visibleTo === 'admin' ? 'Note for the Servios team — not shown to either side.' : 'Message — the recipient is emailed and can reply on the booking page.'}
                  className={`w-full resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${visibleTo === 'admin' ? 'border-yellow-300 bg-yellow-50/40' : 'border-gray-200'}`} />
                <div className="flex justify-end">
                  <button onClick={send} disabled={sending || !message.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                    {sending ? 'Sending…' : visibleTo === 'admin' ? 'Save note' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Booking chat" right={
            <button onClick={() => setShowChat(v => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              {showChat ? <>Hide <ChevronUp size={13} /></> : <>Show {view.chat.length} messages <ChevronDown size={13} /></>}
            </button>
          }>
            {!showChat ? (
              <p className="text-sm text-gray-500">Read-only copy of what the customer and provider said to each other before the report.</p>
            ) : view.chat.length === 0 ? (
              <p className="text-sm text-gray-400">They never messaged each other on Servios.</p>
            ) : (
              <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
                {view.chat.map(m => (
                  <div key={m.id} className={`flex ${m.fromCustomer ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.fromCustomer ? 'bg-gray-100 text-gray-800' : 'bg-primary/10 text-gray-900'}`}>
                      <p className="text-[11px] text-gray-500">{m.senderName} · {when(m.createdAt)}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {view.photos.length > 0 && (
            <Card title="Job photos">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {view.photos.map(ph => ph.url && (
                  <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-lg ring-1 ring-gray-200">
                    <img src={ph.url} alt={`${ph.type} photo`} className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">{ph.type} · {ph.by}</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right: parties, money, decision ── */}
        <aside className="space-y-5 lg:sticky lg:top-6">
          <Card title="People">
            <div className="space-y-4">
              <PersonCard label="Customer" p={view.customer} />
              <PersonCard label="Provider" p={view.provider} />
            </div>
          </Card>

          <Card title="Money">
            {!p ? (
              <p className="text-sm text-gray-500">No payment on this booking — nothing to refund or release.</p>
            ) : (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Job total</dt><dd className="font-semibold text-gray-900">{pounds(p.amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Payment</dt><dd className="capitalize text-gray-900">{p.status.replace('_', ' ')}{p.simulated ? ' (simulated)' : ''}</dd></div>
                {p.refunded > 0 && <div className="flex justify-between"><dt className="text-gray-500">Refunded so far</dt><dd className="text-gray-900">{pounds(p.refunded)}</dd></div>}
                <div className="flex justify-between"><dt className="text-gray-500">Provider share</dt><dd className="text-gray-900">{pounds(p.providerShare)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Servios commission</dt><dd className="text-gray-900">{pounds(p.commission)}</dd></div>
                <div className="flex justify-between border-t border-gray-100 pt-1.5"><dt className="text-gray-500">Paid to provider so far</dt><dd className="text-gray-900">{pounds(p.transferred)}</dd></div>
                {p.held > 0 && <div className="flex justify-between"><dt className="inline-flex items-center gap-1 text-amber-700"><Lock size={12} /> Held for this case</dt><dd className="font-semibold text-amber-700">{pounds(p.held)}</dd></div>}
                {p.status === 'authorized' && <p className="pt-1 text-xs text-gray-500">The card is authorised but not charged — the customer hadn’t confirmed the job.</p>}
              </dl>
            )}
          </Card>

          {d.open && <ResolvePanel view={view} onDone={msg => { setToast(msg); load() }} />}

          {view.audit.length > 0 && (
            <Card title="Activity">
              <ul className="space-y-2 text-xs text-gray-500">
                {view.audit.map(a => (
                  <li key={a.id}><span className="font-medium text-gray-700">{a.action.replace(/^dispute\./, '').replace(/[._]/g, ' ')}</span> · {when(a.created_at)}{a.reason ? <span className="block text-gray-400">{a.reason}</span> : null}</li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
