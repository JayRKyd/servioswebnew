'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, EyeOff, Flag, RefreshCw, Star, Trash2, Undo2 } from 'lucide-react'

interface Review {
  id: string; bookingId: string; bookingNumber: string | null; service: string | null; rating: number; text: string | null; createdAt: string
  reviewer: { id: string; name: string; email: string | null; hasProfile: boolean }
  provider: { id: string; name: string }
  flagged: boolean; flagReason: string | null; flaggedAt: string | null
  hidden: boolean; hiddenAt: string | null; hiddenReason: string | null
}
const when = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function ReviewsInner() {
  const params = useSearchParams()
  const [filter, setFilter] = useState<'all' | 'flagged' | 'hidden'>((params.get('filter') as any) || 'all')
  const [rows, setRows] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, setPending] = useState<{ id: string; action: 'hide' | 'delete' } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (f: typeof filter) => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/admin/reviews?filter=${f}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`); else setRows(json.reviews ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load(filter) }, [filter, load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t) }, [toast])

  async function act(id: string, action: 'hide' | 'unhide' | 'delete' | 'clear_flag', why = '') {
    setBusy(true); setError(null)
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason: why }) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Action failed')
    else { setToast({ hide: 'Review hidden — it no longer shows publicly or counts toward the rating.', unhide: 'Review restored.', delete: 'Review deleted permanently.', clear_flag: 'Flag cleared — the review stays up.' }[action]); setPending(null); setReason(''); await load(filter) }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="mt-0.5 text-sm text-gray-500">Hide a fake or abusive review (reversible, drops out of the rating) or delete it outright. Providers can report reviews about them.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(['flagged', 'all', 'hidden'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>{f === 'flagged' ? 'Reported' : f}</button>
            ))}
          </div>
          <button onClick={() => load(filter)} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {toast && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {toast}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      {!loading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Star size={28} className="text-gray-300" />
          <p className="text-sm text-gray-400">{filter === 'flagged' ? 'No reported reviews.' : filter === 'hidden' ? 'No hidden reviews.' : 'No reviews yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${r.flagged && !r.hidden ? 'ring-amber-200' : r.hidden ? 'ring-gray-200 opacity-80' : 'ring-gray-100'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-amber-500" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span className="text-gray-200">{'★'.repeat(5 - r.rating)}</span></span>
                    <span className="text-sm font-semibold text-gray-900">{r.reviewer.name}</span>
                    <span className="text-xs text-gray-400">→ {r.provider.name}</span>
                    {!r.reviewer.hasProfile && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">reviewer has no account</span>}
                    {r.flagged && !r.hidden && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"><Flag size={10} /> reported</span>}
                    {r.hidden && <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700"><EyeOff size={10} /> hidden</span>}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{when(r.createdAt)} · {r.service ?? 'Booking'} · <Link href={`/admin/bookings/${r.bookingId}`} className="font-mono hover:underline">{r.bookingNumber}</Link>{r.reviewer.email ? ` · ${r.reviewer.email}` : ''}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {r.flagged && !r.hidden && <button disabled={busy} onClick={() => act(r.id, 'clear_flag')} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Keep it up</button>}
                  {!r.hidden ? (
                    <button disabled={busy} onClick={() => { setPending({ id: r.id, action: 'hide' }); setReason(r.flagReason ?? '') }} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"><EyeOff size={12} /> Hide</button>
                  ) : (
                    <button disabled={busy} onClick={() => act(r.id, 'unhide')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"><Undo2 size={12} /> Restore</button>
                  )}
                  <button disabled={busy} onClick={() => { setPending({ id: r.id, action: 'delete' }); setReason('') }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={12} /> Delete</button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">{r.text || <span className="italic text-gray-400">No written review — rating only.</span>}</p>
              {r.flagReason && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Provider’s report:</strong> {r.flagReason}</p>}
              {r.hiddenReason && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><strong>Hidden {when(r.hiddenAt)}:</strong> {r.hiddenReason}</p>}

              {pending?.id === r.id && (
                <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-900">{pending.action === 'hide' ? 'Hide this review?' : 'Delete this review permanently?'}</p>
                  <p className="text-xs text-gray-500">{pending.action === 'hide' ? 'It disappears from the provider’s profile and rating. You can restore it later.' : 'This can’t be undone. Prefer Hide unless it must go.'}</p>
                  <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (kept in the audit log)" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex gap-2">
                    <button disabled={busy || !reason.trim()} onClick={() => act(r.id, pending.action, reason)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${pending.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>{busy ? 'Working…' : pending.action === 'hide' ? 'Hide review' : 'Delete review'}</button>
                    <button disabled={busy} onClick={() => setPending(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-white">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminReviewsPage() {
  return <Suspense fallback={<div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>}><ReviewsInner /></Suspense>
}
