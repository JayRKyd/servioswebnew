'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, RefreshCw, Trash2 } from 'lucide-react'

type Kind = 'orphan_provider' | 'orphan_customer' | 'orphan_review' | 'default_bio' | 'duplicate_category' | 'seed_booking' | 'test_account'
interface Item { kind: Kind; id: string; label: string; detail: string; protectedReason?: string }
interface Result { kind: Kind; id: string; outcome: string; ok: boolean }

const KIND: Record<Kind, { title: string; blurb: string }> = {
  orphan_review: { title: 'Seeded / orphan reviews', blurb: 'Reviews whose author has no account. Pete’s "Customer" reviews live here.' },
  seed_booking: { title: 'Seeded bookings', blurb: 'BK-SEED-… bookings and everything attached to them.' },
  orphan_provider: { title: 'Orphan provider profiles', blurb: 'Profiles left behind after the login was deleted in Supabase Auth.' },
  orphan_customer: { title: 'Orphan customer profiles', blurb: 'Same, for customers.' },
  default_bio: { title: 'Placeholder bios', blurb: '"A trusted and established member of the Servios community." Clears the text only.' },
  duplicate_category: { title: 'Duplicate categories', blurb: 'e.g. "carpentry" next to "Carpentry". Services are moved to the canonical one.' },
  test_account: { title: 'Test-looking accounts', blurb: 'Emails with "test", @example.com, @servios.com. Protected accounts can’t be ticked.' },
}
const ORDER: Kind[] = ['orphan_review', 'seed_booking', 'orphan_provider', 'orphan_customer', 'default_bio', 'duplicate_category', 'test_account']

export default function LaunchCleanupPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Result[] | null>(null)

  const load = useCallback(async () => {
    setItems(null); setError(null); setResults(null); setSelected({})
    const res = await fetch('/api/admin/cleanup', { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not scan (${res.status})`); else setItems(json.items ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  const key = (i: { kind: string; id: string }) => `${i.kind}:${i.id}`
  const grouped = useMemo(() => ORDER.map(k => ({ kind: k, items: (items ?? []).filter(i => i.kind === k) })).filter(g => g.items.length), [items])
  const chosen = (items ?? []).filter(i => selected[key(i)] && !i.protectedReason)

  async function run() {
    setBusy(true); setError(null)
    const res = await fetch('/api/admin/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: chosen.map(i => ({ kind: i.kind, id: i.id })), confirm }) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Cleanup failed')
    else { setResults(json.results); setConfirm(''); setSelected({}); const r2 = await fetch('/api/admin/cleanup', { cache: 'no-store' }); const j2: any = await r2.json().catch(() => ({})); if (r2.ok) setItems(j2.items ?? []) }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/settings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={14} /> Settings</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Launch cleanup</h1>
          <p className="mt-1 text-sm text-gray-500">Placeholder and orphaned content found in the live database. Tick what to remove; nothing happens until you type DELETE. Every run is logged.</p>
        </div>
        <button onClick={load} disabled={!items} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Rescan"><RefreshCw size={15} className={!items ? 'animate-spin' : ''} /></button>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}
      {results && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900"><CheckCircle2 size={16} /> {results.filter(r => r.ok).length} of {results.length} removed</p>
          <ul className="mt-2 space-y-1 text-xs">{results.map(r => <li key={key(r)} className={r.ok ? 'text-green-800' : 'text-red-700'}>{KIND[r.kind].title}: {r.outcome}</li>)}</ul>
        </div>
      )}

      {!items ? <div className="flex h-40 items-center justify-center text-gray-400">Scanning…</div> : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center"><CheckCircle2 size={28} className="text-green-400" /><p className="text-sm text-gray-500">Nothing left to clean up.</p></div>
      ) : (
        <div className="space-y-4">
          {grouped.map(g => {
            const selectable = g.items.filter(i => !i.protectedReason)
            const allOn = selectable.length > 0 && selectable.every(i => selected[key(i)])
            return (
              <section key={g.kind} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <div><h2 className="text-sm font-bold text-gray-900">{KIND[g.kind].title} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{g.items.length}</span></h2><p className="text-xs text-gray-500">{KIND[g.kind].blurb}</p></div>
                  {selectable.length > 0 && <button onClick={() => setSelected(s => ({ ...s, ...Object.fromEntries(selectable.map(i => [key(i), !allOn])) }))} className="text-xs font-medium text-primary hover:underline">{allOn ? 'Clear' : 'Select all'}</button>}
                </div>
                <ul className="divide-y divide-gray-50">
                  {g.items.map(i => (
                    <li key={key(i)} className="flex items-start gap-3 px-5 py-3">
                      {i.protectedReason ? <Lock size={14} className="mt-1 shrink-0 text-gray-300" /> : <input type="checkbox" checked={!!selected[key(i)]} onChange={e => setSelected(s => ({ ...s, [key(i)]: e.target.checked }))} className="mt-1 accent-[#115e56]" />}
                      <div className="min-w-0"><p className="text-sm font-medium text-gray-900">{i.label}</p><p className="text-xs text-gray-500">{i.detail}</p>{i.protectedReason && <p className="text-[11px] text-gray-400">{i.protectedReason}</p>}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {chosen.length > 0 && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-gray-900">{chosen.length} item{chosen.length === 1 ? '' : 's'} selected</p>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type DELETE to confirm" className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          <button disabled={busy || confirm !== 'DELETE'} onClick={run} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"><Trash2 size={14} /> {busy ? 'Removing…' : 'Remove selected'}</button>
        </div>
      )}
    </div>
  )
}
