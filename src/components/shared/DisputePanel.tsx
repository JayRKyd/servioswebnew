'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Clock, FileText, Lock, MessageSquare, ShieldAlert, X } from 'lucide-react'
import { supabase } from '@/lib/auth'

type Viewer = 'customer' | 'provider'

const TYPE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'not_completed', label: 'Work not finished', hint: 'Part of the job wasn’t done' },
  { value: 'poor_quality', label: 'Poor quality work', hint: 'Done, but not to a reasonable standard' },
  { value: 'damage', label: 'Damage to property', hint: 'Something was damaged during the job' },
  { value: 'no_show', label: 'Provider didn’t turn up', hint: 'No-show on the booked date' },
  { value: 'overcharged', label: 'Charged more than agreed', hint: 'The price isn’t what was agreed' },
  { value: 'problem_after', label: 'Problem appeared after the job', hint: 'A leak, fault or crack that showed up later' },
  { value: 'other', label: 'Something else', hint: '' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries([...TYPE_OPTIONS.map(o => [o.value, o.label]), ['chargeback', 'Bank chargeback']])
const OUTCOME_LABEL: Record<string, string> = { full_refund: 'Full refund', partial_refund: 'Partial refund', redo: 'Provider to put it right', other: 'Something else' }

const OPEN_STATUS = { label: 'Reported — waiting for review', cls: 'bg-amber-50 text-amber-800 ring-amber-200' }
const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Reported — waiting for review', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  under_review: { label: 'Servios support is reviewing', cls: 'bg-blue-50 text-blue-800 ring-blue-200' },
  awaiting_customer: { label: 'Waiting for the customer', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  awaiting_provider: { label: 'Waiting for the provider', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  resolved: { label: 'Resolved', cls: 'bg-green-50 text-green-800 ring-green-200' },
  closed: { label: 'Closed', cls: 'bg-gray-100 text-gray-700 ring-gray-200' },
}

const RESOLUTION_LABEL: Record<string, string> = {
  full_refund: 'Customer refunded in full',
  partial_refund: 'Partial refund to the customer',
  release_to_provider: 'Payment released to the provider',
  no_action: 'Closed with no change to the payment',
  chargeback_won: 'Bank ruled for Servios',
  chargeback_lost: 'Bank ruled for the customer',
}

const pounds = (p: number | null | undefined) => `£${((p ?? 0) / 100).toFixed(2)}`
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface FileRef { path: string; url: string | null; kind: 'image' | 'pdf' | 'file' }
interface View {
  dispute: {
    id: string; number: string; status: string; open: boolean; source: string; type: string; reason: string
    desiredOutcome: string | null; desiredAmount: number | null; providerResponse: string | null
    resolutionType: string | null; resolutionNotes: string | null; refundAmount: number | null
    filedAt: string; resolvedAt: string | null; evidence: FileRef[]
  }
  booking: { id: string; number: string | null; total: number } | null
  customer: { name: string } | null
  provider: { name: string } | null
  thread: { id: string; role: string; senderName: string; body: string; createdAt: string; attachments: FileRef[] }[]
}
interface Eligibility { allowed: boolean; reason: string | null; deadline: string | null }
interface Payload { viewer: Viewer; view: View | null; eligibility: Eligibility | null }

async function uploadEvidence(bookingId: string, files: File[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please sign in again')
  const paths: string[] = []
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB`)
    const safe = f.name.replace(/[^\w.-]+/g, '_').slice(-60)
    const path = `${user.id}/${bookingId}/${Date.now()}-${safe}`
    const { error } = await supabase.storage.from('dispute-evidence').upload(path, f, { contentType: f.type })
    if (error) throw new Error(`Upload failed for ${f.name}: ${error.message}`)
    paths.push(path)
  }
  return paths
}

function Files({ files }: { files: FileRef[] }) {
  if (!files.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map(f => f.url && f.kind === 'image' ? (
        <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer" className="block h-20 w-20 overflow-hidden rounded-lg ring-1 ring-gray-200">
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

function FilePicker({ files, onChange, label = 'Add photos or files' }: { files: File[]; onChange: (f: File[]) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
              {f.name.slice(0, 28)}
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500" aria-label="Remove"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <input ref={ref} type="file" multiple accept="image/*,application/pdf" className="hidden"
        onChange={e => { onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = '' }} />
      <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary">
        <Camera size={13} /> {label}
      </button>
    </div>
  )
}

/** Report-a-problem + dispute thread for one booking. Rendered on both the
 *  customer and provider booking pages; anchored at #problem for email links. */
export function DisputePanel({ bookingId, totalPence, openForm, onFormClosed, onState }: {
  bookingId: string
  totalPence: number
  /** Parent can open the report form (e.g. from the confirm-complete banner). */
  openForm?: boolean
  onFormClosed?: () => void
  /** Lets the page hide Confirm/Pay while a case is open. */
  onState?: (s: { hasOpenDispute: boolean; canReport: boolean }) => void
}) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Report form
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [outcome, setOutcome] = useState<'full_refund' | 'partial_refund' | 'redo' | 'other'>('full_refund')
  const [amount, setAmount] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Reply
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/disputes/by-booking/${bookingId}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => null)
    if (res.ok && json) {
      setData(json)
      onState?.({ hasOpenDispute: !!json.view?.dispute?.open, canReport: !!json.eligibility?.allowed })
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (openForm) {
      setShowForm(true)
      document.getElementById('problem')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [openForm])

  function closeForm() {
    setShowForm(false); setError(null); onFormClosed?.()
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!type) { setError('Choose what went wrong'); return }
    if (description.trim().length < 20) { setError('Please describe the problem in a little more detail (20 characters or more)'); return }
    const amountPence = outcome === 'partial_refund' ? Math.round(parseFloat(amount) * 100) : null
    if (outcome === 'partial_refund' && !(amountPence && amountPence > 0 && amountPence <= totalPence)) {
      setError(`Enter an amount up to ${pounds(totalPence)}`); return
    }
    setSubmitting(true)
    try {
      const evidencePaths = files.length ? await uploadEvidence(bookingId, files) : []
      const res = await fetch('/api/disputes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, type, description, desiredOutcome: outcome, desiredAmountPence: amountPence, evidencePaths }),
      })
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Could not send your report')
      setShowForm(false); setFiles([]); setDescription(''); setType('')
      onFormClosed?.()
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function sendReply() {
    if (!data?.view || !reply.trim()) return
    setSending(true); setError(null)
    try {
      const attachments = replyFiles.length ? await uploadEvidence(bookingId, replyFiles) : []
      const res = await fetch(`/api/disputes/${data.view.dispute.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply, attachments }),
      })
      const json: any = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Could not send')
      setReply(''); setReplyFiles([])
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loading || !data) return null
  const { viewer, view, eligibility } = data
  const d = view?.dispute
  // Nothing to show: provider with no case, or customer who can't report and has no case
  if (!d && (viewer === 'provider' || (!eligibility?.allowed && !showForm))) return null

  return (
    <section id="problem" className="scroll-mt-6 space-y-4">
      {/* ── Entry point ── */}
      {!d && viewer === 'customer' && eligibility?.allowed && !showForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Something not right?</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Tell us what happened and we’ll hold the payment while Servios support looks into it.
              {eligibility.deadline && <> You can report a problem until {new Date(eligibility.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</>}
            </p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            <ShieldAlert size={15} /> Report a problem
          </button>
        </div>
      )}

      {/* ── Report form ── */}
      {showForm && viewer === 'customer' && (
        <form onSubmit={submitReport} className="space-y-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-red-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Report a problem</h3>
              <p className="mt-0.5 text-xs text-gray-500">The provider is asked for their side, the payment is held, and Servios support decides. Nothing is released while it’s open.</p>
            </div>
            <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X size={18} /></button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">What went wrong?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPE_OPTIONS.map(o => (
                <label key={o.value} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition-colors ${type === o.value ? 'border-primary bg-primary/[0.05] ring-1 ring-primary' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="type" value={o.value} checked={type === o.value} onChange={() => setType(o.value)} className="sr-only" />
                  <span className="font-medium text-gray-900">{o.label}</span>
                  {o.hint && <span className="mt-0.5 block text-xs text-gray-500">{o.hint}</span>}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Describe what happened</label>
            <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What was agreed, what happened, and when you noticed. Dates and specifics help us resolve it quickly."
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">What would you like to happen?</p>
            <div className="flex flex-wrap gap-2">
              {(['full_refund', 'partial_refund', 'redo', 'other'] as const).map(o => (
                <button key={o} type="button" onClick={() => setOutcome(o)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${outcome === o ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                  {OUTCOME_LABEL[o]}
                </button>
              ))}
            </div>
            {outcome === 'partial_refund' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-500">£</span>
                <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00"
                  className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <span className="text-xs text-gray-400">of {pounds(totalPence)}</span>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Photos <span className="font-normal normal-case text-gray-400">(strongly recommended)</span></p>
            <FilePicker files={files} onChange={setFiles} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {submitting ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" onClick={closeForm} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Case ── */}
      {d && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{d.source === 'chargeback' ? 'Bank chargeback' : 'Problem report'} · {d.number}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{TYPE_LABEL[d.type] ?? 'Problem reported'}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${(STATUS[d.status] ?? OPEN_STATUS).cls}`}>{(STATUS[d.status] ?? OPEN_STATUS).label}</span>
          </div>

          {d.open && (
            <div className="flex items-start gap-2.5 bg-amber-50/60 px-5 py-3 text-xs text-amber-800">
              <Lock size={14} className="mt-0.5 shrink-0" />
              {viewer === 'customer'
                ? <span>The payment for this job is on hold. Servios support will review both sides and decide — usually within 2 working days.</span>
                : <span>The amount in question is on hold until this is resolved. {d.providerResponse ? 'Thanks for responding — support will be in touch.' : <strong>Please give your side below — support reads both before deciding.</strong>}</span>}
            </div>
          )}

          {!d.open && d.resolutionType && (
            <div className="flex items-start gap-2.5 bg-green-50/70 px-5 py-3 text-sm text-green-900">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
              <div>
                <p className="font-semibold">{RESOLUTION_LABEL[d.resolutionType] ?? 'Resolved'}{d.refundAmount ? ` — ${pounds(d.refundAmount)}` : ''}</p>
                {d.resolutionNotes && <p className="mt-0.5 text-xs text-green-800">{d.resolutionNotes}</p>}
              </div>
            </div>
          )}

          <div className="space-y-4 px-5 py-4">
            {/* Original report */}
            <div className="rounded-lg bg-gray-50 p-3.5">
              <p className="text-xs text-gray-500">
                {d.source === 'chargeback' ? 'Raised by the customer’s bank' : `${viewer === 'customer' ? 'You' : view?.customer?.name ?? 'The customer'} reported`} · {when(d.filedAt)}
                {d.desiredOutcome && d.source !== 'chargeback' && <> · asked for <strong>{OUTCOME_LABEL[d.desiredOutcome] ?? d.desiredOutcome}{d.desiredOutcome === 'partial_refund' && d.desiredAmount ? ` (${pounds(d.desiredAmount)})` : ''}</strong></>}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-800">{d.reason}</p>
              <Files files={d.evidence} />
            </div>

            {/* Thread */}
            {view!.thread.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'system' ? 'justify-center' : ''}`}>
                {m.role === 'system' ? (
                  <p className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500"><Clock size={11} /> {m.body} · {when(m.createdAt)}</p>
                ) : (
                  <div className={`w-full rounded-lg p-3.5 ${m.role === 'admin' ? 'bg-primary/[0.06] ring-1 ring-primary/15' : m.role === viewer ? 'bg-white ring-1 ring-gray-200' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500">
                      <span className={`font-semibold ${m.role === 'admin' ? 'text-primary' : 'text-gray-800'}`}>{m.role === viewer ? 'You' : m.senderName}</span> · {when(m.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{m.body}</p>
                    <Files files={m.attachments} />
                  </div>
                )}
              </div>
            ))}

            {/* Reply */}
            {d.open && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <MessageSquare size={13} /> {viewer === 'provider' && !d.providerResponse ? 'Your side of what happened' : 'Add to this case'}
                </label>
                <textarea rows={3} value={reply} onChange={e => setReply(e.target.value)}
                  placeholder={viewer === 'provider' ? 'Explain what was agreed and what you did. Before/after photos help.' : 'Anything new — more detail, photos, or an update.'}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FilePicker files={replyFiles} onChange={setReplyFiles} label="Attach" />
                  <button onClick={sendReply} disabled={sending || !reply.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">Both sides and Servios support can see messages here.</p>
              </div>
            )}
            {error && !showForm && <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={14} /> {error}</p>}
          </div>
        </div>
      )}

      {/* A new report after a resolved one */}
      {d && !d.open && viewer === 'customer' && eligibility?.allowed && !showForm && (
        <button onClick={() => setShowForm(true)} className="text-xs font-medium text-red-600 hover:underline">Report another problem with this job</button>
      )}
    </section>
  )
}
