'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

type Key = 'dispute_window_days' | 'payout_delay_days' | 'new_provider_payout_delay_days' | 'new_provider_job_threshold' | 'upheld_reset_jobs' | 'upheld_reset_days'
type Limits = Record<Key, { min: number; max: number; label: string; help: string }>
const ORDER: Key[] = ['dispute_window_days', 'payout_delay_days', 'new_provider_payout_delay_days', 'new_provider_job_threshold', 'upheld_reset_jobs', 'upheld_reset_days']

export default function PaymentSettingsPage() {
  const [values, setValues] = useState<Record<Key, string> | null>(null)
  const [saved, setSaved] = useState<Record<Key, number> | null>(null)
  const [limits, setLimits] = useState<Limits | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [vat, setVat] = useState('')
  const [vatSaved, setVatSaved] = useState<string | null>(null)
  const [vatBusy, setVatBusy] = useState(false)
  const [vatMsg, setVatMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store' }).then(r => r.json()).then((json: any) => {
      if (json?.error) { setError(json.error); return }
      setSaved(json.settings); setLimits(json.limits)
      setVat(json.vatNumber ?? ''); setVatSaved(json.vatNumber ?? null)
      setValues(Object.fromEntries(ORDER.map(k => [k, String(json.settings[k])])) as Record<Key, string>)
    }).catch(() => setError('Could not load settings'))
  }, [])

  const dirty = !!values && !!saved && ORDER.some(k => Number(values[k]) !== saved[k])

  async function save() {
    if (!values || !saved) return
    setBusy(true); setError(null); setDone(false)
    const changes = Object.fromEntries(ORDER.filter(k => Number(values[k]) !== saved[k]).map(k => [k, Number(values[k])]))
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Could not save')
    else { setSaved(json.settings); setDone(true) }
    setBusy(false)
  }

  async function saveVat() {
    setVatBusy(true); setVatMsg(null)
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vat_number: vat }) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setVatMsg({ ok: false, text: json?.error ?? 'Could not save' })
    else {
      setVatSaved(json.vatNumber ?? null); setVat(json.vatNumber ?? '')
      setVatMsg({ ok: true, text: json.vatNumber ? `Saved. ${json.vatNumber} now appears on receipts and provider payment emails.` : 'Saved. Receipts no longer mention VAT.' })
    }
    setVatBusy(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/settings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={14} /> Settings</Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disputes & payouts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Providers are paid the moment a customer confirms. The clearing delay is how long that money sits in their Stripe balance —
          where a dispute can still pull it back — before it reaches their bank.
        </p>
      </div>

      {!values || !limits ? (
        <div className="flex h-40 items-center justify-center text-gray-400">{error ?? 'Loading…'}</div>
      ) : (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          {ORDER.map(k => (
            <div key={k} className="grid gap-2 sm:grid-cols-[1fr_120px] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-gray-900">{limits[k].label}</p>
                <p className="text-xs text-gray-500">{limits[k].help}</p>
              </div>
              <input type="number" min={limits[k].min} max={limits[k].max} value={values[k]}
                onChange={e => { setDone(false); setValues(v => v && ({ ...v, [k]: e.target.value })) }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          ))}
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Delay changes apply to each provider the next time their schedule is refreshed — after their next confirmed job, or when they connect their bank.
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {done && <p className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 size={15} /> Saved. The change is logged in the admin activity trail.</p>}
          <button onClick={save} disabled={!dirty || busy} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {values && limits && (
        <div className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">VAT registration number</p>
            <p className="text-xs text-gray-500">
              Leave blank if Servios Group Ltd is not VAT registered. When set, the number is shown on customer receipts and on the
              provider&apos;s payment email next to the commission.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={vat} onChange={e => { setVat(e.target.value); setVatMsg(null) }} placeholder="GB123456789"
              className="w-full max-w-[220px] rounded-xl border border-gray-200 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={saveVat} disabled={vatBusy || vat.trim().toUpperCase().replace(/[\s.-]/g, '') === (vatSaved ?? '')}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
              {vatBusy ? 'Saving…' : vat.trim() ? 'Save' : 'Clear'}
            </button>
            <span className="text-xs text-gray-400">{vatSaved ? `Currently ${vatSaved}` : 'Not set'}</span>
          </div>
          {vatMsg && <p className={`text-sm ${vatMsg.ok ? 'text-green-700' : 'text-red-700'}`}>{vatMsg.text}</p>}
        </div>
      )}
    </div>
  )
}
