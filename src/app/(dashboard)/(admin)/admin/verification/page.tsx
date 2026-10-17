'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BadgeCheck, Check, X, Clock, AlertTriangle, ExternalLink, Search,
  ShieldCheck, Shield, CreditCard, Award, FileText, RefreshCw, ChevronDown, ChevronUp,
  Mail, Phone, MapPin, Wrench, CalendarDays,
} from 'lucide-react'
import { titleCase } from '@/lib/utils'
import type { QueueProvider, QueueDocument, RequiredState } from '@/server/lib/verification'

/* ─── Labels & styling ─── */

const DOC_META: Record<string, { label: string; icon: React.ElementType; numberLabel: string | null; issuerLabel: string | null }> = {
  id:            { label: 'Photo ID',      icon: CreditCard, numberLabel: null,                      issuerLabel: null },
  insurance:     { label: 'Insurance',     icon: Shield,     numberLabel: 'Policy number',           issuerLabel: 'Insurer' },
  license:       { label: 'Licence',       icon: Award,      numberLabel: 'Registration number',     issuerLabel: 'Issuing body' },
  certification: { label: 'Certification', icon: BadgeCheck, numberLabel: 'Certificate number',      issuerLabel: 'Issuing body' },
  contract:      { label: 'Contract',      icon: FileText,   numberLabel: null,                      issuerLabel: null },
  other:         { label: 'Other',         icon: FileText,   numberLabel: 'Reference',               issuerLabel: 'Issuer' },
}

const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Awaiting review', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Approved',        cls: 'bg-green-50 text-green-700 ring-green-200' },
  rejected: { label: 'Not approved',    cls: 'bg-red-50 text-red-700 ring-red-200' },
  expired:  { label: 'Expired',         cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
}

const PROVIDER_STATUS: Record<string, { label: string; cls: string }> = {
  verified:   { label: 'Verified',        cls: 'bg-green-50 text-green-700 ring-green-200' },
  pending:    { label: 'Awaiting review', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  unverified: { label: 'Not submitted',   cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  rejected:   { label: 'Rejected',        cls: 'bg-red-50 text-red-700 ring-red-200' },
}

const REQUIRED_STATE: Record<RequiredState, { label: string; cls: string }> = {
  approved: { label: 'Approved',  cls: 'bg-green-50 text-green-700' },
  pending:  { label: 'In review', cls: 'bg-amber-50 text-amber-700' },
  rejected: { label: 'Rejected',  cls: 'bg-red-50 text-red-700' },
  expired:  { label: 'Expired',   cls: 'bg-gray-100 text-gray-600' },
  missing:  { label: 'Missing',   cls: 'bg-gray-100 text-gray-500' },
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - Date.now()) / 86_400_000)
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{label}</span>
}

function Avatar({ p, size = 44 }: { p: QueueProvider; size?: number }) {
  const initial = (p.name || '?').charAt(0).toUpperCase()
  return p.profile_image_url ? (
    <img src={p.profile_image_url} alt={p.name} style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-1 ring-gray-200" />
  ) : (
    <div style={{ width: size, height: size, fontSize: size / 2.6 }} className="flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{initial}</div>
  )
}

/* ─── Helpers ─── */

async function adminPost(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
  return json
}

/** Human sentence for what a decision changed about the provider. */
function outcomeFor(before: QueueProvider, after: QueueProvider, what: string): string {
  if (before.verification_status !== 'verified' && after.verification_status === 'verified') {
    return `${what} — ${after.name} is now verified and visible in search.`
  }
  if (before.verification_status === 'verified' && after.verification_status !== 'verified') {
    return `${what} — ${after.name} is no longer verified and has been removed from search.`
  }
  if (after.verification_status !== 'verified') {
    const missing = (['id', 'insurance'] as const).filter(t => after.required[t] !== 'approved')
    if (missing.length > 0) {
      const names = missing.map(t => (t === 'id' ? 'photo ID' : 'insurance')).join(' and ')
      return `${what}. Still needed before ${after.name} goes live: ${names}.`
    }
  }
  return `${what}.`
}

/* ─── Document card ─── */

function DocumentCard({ doc, onReview }: { doc: QueueDocument; onReview: (docId: string, body: Record<string, unknown>) => Promise<void> }) {
  const meta = DOC_META[doc.document_type] ?? DOC_META.other
  const Icon = meta.icon
  const status = DOC_STATUS[doc.status] ?? DOC_STATUS.pending
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle')
  const [showPreview, setShowPreview] = useState(doc.status === 'pending')
  const [verifiedNumber, setVerifiedNumber] = useState(doc.verified_number ?? doc.credential_number ?? '')
  const [issuer, setIssuer] = useState(doc.issuer ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const expiresIn = daysUntil(doc.expiry_date)

  async function submit(body: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      await onReview(doc.id, body)
      setMode('idle')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const canReview = doc.status !== 'approved'

  return (
    <div className={`rounded-2xl bg-white ring-1 shadow-sm ${doc.status === 'pending' ? 'ring-amber-200' : 'ring-gray-100'}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="rounded-xl bg-gray-50 p-2.5 text-gray-500"><Icon size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900 truncate">{doc.title}</p>
            <Pill {...status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {meta.label} · uploaded {fmtDate(doc.created_at)}
            {doc.expiry_date && (
              <span className={expiresIn != null && expiresIn < 0 ? ' text-red-600 font-medium' : expiresIn != null && expiresIn <= 30 ? ' text-amber-600 font-medium' : ''}>
                {' '}· {expiresIn != null && expiresIn < 0 ? 'expired' : 'expires'} {fmtDate(doc.expiry_date)}
              </span>
            )}
          </p>
          {(doc.credential_number || doc.issuer) && doc.status !== 'approved' && (
            <p className="mt-1.5 text-xs text-gray-600">
              Provider entered: <span className="font-medium">{doc.credential_number || '—'}</span>{doc.issuer ? ` · ${doc.issuer}` : ''}
            </p>
          )}
          {doc.status === 'approved' && (
            <p className="mt-1.5 text-xs text-green-700">
              {doc.verified_number ? <>Confirmed number <span className="font-semibold">{doc.verified_number}</span>{doc.issuer ? ` · ${doc.issuer}` : ''} · </> : null}
              approved {fmtDate(doc.verified_at)}
            </p>
          )}
          {doc.status === 'rejected' && doc.rejection_reason && (
            <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">Reason sent to provider: {doc.rejection_reason}</p>
          )}
        </div>
      </div>

      {/* File preview */}
      {doc.kind !== 'none' && (
        <div className="border-t border-gray-100">
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={() => setShowPreview(v => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
              {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showPreview ? 'Hide file' : 'Show file'}
            </button>
            {doc.signed_url && (
              <a href={doc.signed_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open in new tab <ExternalLink size={12} />
              </a>
            )}
          </div>
          {showPreview && (
            <div className="bg-gray-50 px-4 pb-4">
              {!doc.signed_url ? (
                <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">File link unavailable — the stored path may be missing.</p>
              ) : doc.kind === 'pdf' ? (
                <iframe src={doc.signed_url} title={doc.title} className="h-[520px] w-full rounded-lg border border-gray-200 bg-white" />
              ) : doc.kind === 'image' ? (
                <img src={doc.signed_url} alt={doc.title} className="max-h-[520px] w-full rounded-lg border border-gray-200 bg-white object-contain" />
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">Preview not available for this file type — open it in a new tab.</p>
              )}
            </div>
          )}
        </div>
      )}
      {doc.kind === 'none' && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs italic text-gray-400">No file attached — text record only.</p>
      )}

      {/* Review actions */}
      {canReview && (
        <div className="border-t border-gray-100 p-4">
          {mode === 'idle' && (
            <div className="flex gap-2">
              <button onClick={() => setMode('approve')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                <Check size={15} /> Approve
              </button>
              <button onClick={() => setMode('reject')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                <X size={15} /> Reject
              </button>
            </div>
          )}

          {mode === 'approve' && (
            <div className="space-y-3">
              {meta.numberLabel && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">{meta.numberLabel} <span className="font-normal normal-case text-gray-400">(as shown on the document)</span></label>
                    <input value={verifiedNumber} onChange={e => setVerifiedNumber(e.target.value)} placeholder="e.g. 512394"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">{meta.issuerLabel}</label>
                    <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder={doc.document_type === 'insurance' ? 'e.g. Aviva' : 'e.g. Gas Safe Register'}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">
                {meta.numberLabel
                  ? 'The confirmed number is what appears on the provider’s public profile badge — check it against the file, not the typed value.'
                  : 'Approving confirms the document is genuine, legible and matches the provider.'}
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => submit({ action: 'approve', verifiedNumber, issuer })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                  <Check size={15} /> {busy ? 'Approving…' : 'Confirm approval'}
                </button>
                <button disabled={busy} onClick={() => { setMode('idle'); setError(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">Reason <span className="font-normal normal-case text-gray-400">(sent to the provider)</span></label>
                <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. The photo is too blurry to read the expiry date — please upload a clearer scan."
                  className="w-full resize-none rounded-xl border border-red-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button disabled={busy || !reason.trim()} onClick={() => submit({ action: 'reject', reason })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  <X size={15} /> {busy ? 'Rejecting…' : 'Confirm rejection'}
                </button>
                <button disabled={busy} onClick={() => { setMode('idle'); setError(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Provider detail pane ─── */

function ProviderDetail({ provider, onChanged }: { provider: QueueProvider; onChanged: (next: QueueProvider, message: string) => void }) {
  const status = PROVIDER_STATUS[provider.verification_status] ?? PROVIDER_STATUS.unverified
  const [action, setAction] = useState<'verify' | 'revoke' | 'reject' | 'reopen' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset inline forms when switching providers
  useEffect(() => { setAction(null); setReason(''); setError(null) }, [provider.id])

  const pendingDocs = provider.documents.filter(d => d.status === 'pending')
  const otherDocs = provider.documents.filter(d => d.status !== 'pending').slice().reverse()
  const hasRequired = provider.required.id === 'approved' && provider.required.insurance === 'approved'

  async function reviewDoc(docId: string, body: Record<string, unknown>) {
    const json = await adminPost(`/api/admin/documents/${docId}/review`, body)
    const what = body.action === 'approve' ? 'Document approved' : 'Document rejected'
    if (json.provider) onChanged(json.provider, outcomeFor(provider, json.provider, what))
  }

  async function runAction() {
    if (!action) return
    setBusy(true); setError(null)
    try {
      const json = await adminPost(`/api/admin/providers/${provider.id}/verification`, { action, reason })
      const what = { verify: 'Provider verified manually', revoke: 'Verification revoked', reject: 'Application rejected', reopen: 'Application reopened' }[action]
      if (json.provider) onChanged(json.provider, outcomeFor(provider, json.provider, what))
      setAction(null); setReason('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ACTION_COPY: Record<NonNullable<typeof action>, { title: string; hint: string; button: string; danger: boolean }> = {
    verify: { title: 'Verify without all required documents', hint: 'Use this only when you have checked the provider another way. The reason is recorded in the audit log and shown on this screen.', button: 'Verify provider', danger: false },
    revoke: { title: 'Revoke verification', hint: 'The provider disappears from search immediately and is emailed the reason.', button: 'Revoke', danger: true },
    reject: { title: 'Reject application', hint: 'The provider is told their application was unsuccessful and can contact support. Documents stay on file.', button: 'Reject application', danger: true },
    reopen: { title: 'Reopen application', hint: 'Moves the provider back to awaiting review.', button: 'Reopen', danger: false },
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="flex items-start gap-4">
          <Avatar p={provider} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 truncate">{titleCase(provider.name)}</h2>
              <Pill {...status} />
              {provider.verification_override && provider.verification_status === 'verified' && (
                <Pill label="Verified manually" cls="bg-blue-50 text-blue-700 ring-blue-200" />
              )}
            </div>
            {provider.business_name && (provider.first_name || provider.last_name) && (
              <p className="text-sm text-gray-500">{titleCase(provider.first_name)} {titleCase(provider.last_name)}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {provider.trade_category && <span className="inline-flex items-center gap-1"><Wrench size={12} /> {titleCase(provider.trade_category)}</span>}
              {provider.city && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {provider.city}</span>}
              {provider.email && <a href={`mailto:${provider.email}`} className="inline-flex items-center gap-1 hover:text-gray-900"><Mail size={12} /> {provider.email}</a>}
              {provider.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {provider.phone}</span>}
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Joined {fmtDate(provider.created_at)}</span>
            </div>
            {provider.verification_notes && (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><span className="font-semibold">Admin note:</span> {provider.verification_notes}</p>
            )}
          </div>
        </div>

        {/* Required checklist */}
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {([
            { key: 'id', label: 'Photo ID', state: provider.required.id, icon: CreditCard },
            { key: 'insurance', label: 'Insurance', state: provider.required.insurance, icon: Shield },
          ] as const).map(item => {
            const s = REQUIRED_STATE[item.state]
            const Icon = item.icon
            return (
              <div key={item.key} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${s.cls}`}>
                <Icon size={14} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{item.label} <span className="font-normal opacity-70">· required</span></p>
                  <p className="text-[11px]">{s.label}</p>
                </div>
              </div>
            )
          })}
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${provider.business_license_verified ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            <Award size={14} />
            <div><p className="text-xs font-semibold">Licence / cert <span className="font-normal opacity-70">· optional</span></p><p className="text-[11px]">{provider.business_license_verified ? 'Approved — badge live' : 'None approved'}</p></div>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${provider.onboarding_complete ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            <ShieldCheck size={14} />
            <div><p className="text-xs font-semibold">Profile</p><p className="text-[11px]">{provider.onboarding_complete ? 'Onboarding complete' : 'Onboarding incomplete'}</p></div>
          </div>
        </div>
      </div>

      {/* Pending documents */}
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Clock size={15} className="text-amber-500" /> Awaiting review
          {pendingDocs.length > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{pendingDocs.length}</span>}
        </h3>
        {pendingDocs.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Nothing waiting for review.</p>
        ) : (
          <div className="space-y-3">{pendingDocs.map(d => <DocumentCard key={d.id} doc={d} onReview={reviewDoc} />)}</div>
        )}
      </section>

      {/* History */}
      {otherDocs.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-gray-900">Reviewed documents</h3>
          <div className="space-y-3">{otherDocs.map(d => <DocumentCard key={d.id} doc={d} onReview={reviewDoc} />)}</div>
        </section>
      )}

      {/* Manual decisions */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h3 className="text-sm font-bold text-gray-900">Manual decisions</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {hasRequired
            ? 'Verification happens automatically once photo ID and insurance are approved — use these only for exceptions.'
            : 'Approve photo ID and insurance above and the provider is verified automatically. These are the exceptions.'}
        </p>
        {!action ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {provider.verification_status !== 'verified' && provider.verification_status !== 'rejected' && !hasRequired && (
              <button onClick={() => setAction('verify')} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Verify without all documents</button>
            )}
            {provider.verification_status === 'verified' && (
              <button onClick={() => setAction('revoke')} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Revoke verification</button>
            )}
            {provider.verification_status !== 'rejected' && (
              <button onClick={() => setAction('reject')} className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Reject application</button>
            )}
            {provider.verification_status === 'rejected' && (
              <button onClick={() => setAction('reopen')} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Reopen application</button>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{ACTION_COPY[action].title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{ACTION_COPY[action].hint}</p>
            </div>
            {action !== 'reopen' && (
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button disabled={busy || (action !== 'reopen' && !reason.trim())} onClick={runAction}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${ACTION_COPY[action].danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}>
                {busy ? 'Saving…' : ACTION_COPY[action].button}
              </button>
              <button disabled={busy} onClick={() => { setAction(null); setReason(''); setError(null) }} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white">Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

/* ─── Page ─── */

function VerificationQueue() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselect = searchParams.get('provider')

  const [scope, setScope] = useState<'queue' | 'all'>('queue')
  const [providers, setProviders] = useState<QueueProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(preselect)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async (nextScope: 'queue' | 'all') => {
    setLoading(true); setError(null)
    try {
      // A deep link to a provider outside the queue still has to resolve
      const url = nextScope === 'queue' && preselect ? `/api/admin/verification/queue?scope=all` : `/api/admin/verification/queue?scope=${nextScope}`
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Could not load the queue (${res.status})`)
      let list: QueueProvider[] = json.providers ?? []
      if (nextScope === 'queue' && preselect) {
        list = list.filter(p => p.pending_count > 0 || p.verification_status === 'pending' || p.id === preselect)
      }
      setProviders(list)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [preselect])

  useEffect(() => { load(scope) }, [scope, load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return providers
    return providers.filter(p => [p.name, p.first_name, p.last_name, p.email, p.trade_category, p.city].some(v => v?.toLowerCase().includes(q)))
  }, [providers, query])

  const selected = providers.find(p => p.id === selectedId) ?? null
  useEffect(() => {
    if (!selected && visible.length > 0) setSelectedId(visible[0].id)
  }, [selected, visible])

  function handleChanged(next: QueueProvider, message: string) {
    setProviders(ps => ps.map(p => (p.id === next.id ? next : p)))
    setToast(message)
  }

  function select(id: string) {
    setSelectedId(id)
    router.replace(`/admin/verification?provider=${id}`, { scroll: false })
  }

  const pendingTotal = providers.reduce((n, p) => n + p.pending_count, 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Verification</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading ? 'Loading…' : scope === 'queue'
              ? `${providers.length} provider${providers.length === 1 ? '' : 's'} waiting · ${pendingTotal} document${pendingTotal === 1 ? '' : 's'} to review`
              : `${providers.length} providers`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
            {(['queue', 'all'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scope === s ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                {s === 'queue' ? 'Needs attention' : 'All providers'}
              </button>
            ))}
          </div>
          <button onClick={() => load(scope)} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {toast && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <BadgeCheck size={16} className="mt-0.5 shrink-0" /> <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        {/* Provider list */}
        <aside className="space-y-3 lg:sticky lg:top-6">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, trade…"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {loading && providers.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-gray-400">Loading…</div>
            ) : visible.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                {scope === 'queue' ? 'Queue is clear — nothing needs attention.' : 'No providers match.'}
              </div>
            ) : visible.map(p => {
              const s = PROVIDER_STATUS[p.verification_status] ?? PROVIDER_STATUS.unverified
              const active = p.id === selectedId
              return (
                <button key={p.id} onClick={() => select(p.id)}
                  className={`w-full rounded-2xl bg-white p-3 text-left ring-1 transition-all ${active ? 'ring-2 ring-primary shadow-sm' : 'ring-gray-100 hover:ring-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <Avatar p={p} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{titleCase(p.name)}</p>
                        {p.pending_count > 0 && <span className="shrink-0 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{p.pending_count}</span>}
                      </div>
                      <p className="truncate text-xs text-gray-500">{[p.trade_category && titleCase(p.trade_category), p.city].filter(Boolean).join(' · ') || p.email || '—'}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Pill {...s} />
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${REQUIRED_STATE[p.required.id].cls}`}>ID · {REQUIRED_STATE[p.required.id].label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${REQUIRED_STATE[p.required.insurance].cls}`}>Ins · {REQUIRED_STATE[p.required.insurance].label}</span>
                  </div>
                  {p.oldest_pending_at && (
                    <p className="mt-1.5 text-[11px] text-gray-400">Waiting since {fmtDate(p.oldest_pending_at)}</p>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Detail */}
        <main>
          {selected ? (
            <ProviderDetail provider={selected} onChanged={handleChanged} />
          ) : !loading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              Select a provider to review their documents.
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default function AdminVerificationPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>}>
      <VerificationQueue />
    </Suspense>
  )
}
