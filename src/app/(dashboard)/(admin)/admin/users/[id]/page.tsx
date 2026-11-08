'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail, Phone, ShieldCheck, Star } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'

const pounds = (p: number | null | undefined) => `£${((p ?? 0) / 100).toFixed(2)}`
const when = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const day = (iso: string | null | undefined) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"><div className="border-b border-gray-100 px-5 py-3"><h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h2></div><div className="p-5">{children}</div></section>
}

type Action = 'suspend' | 'reinstate' | 'close' | 'reset_password' | 'note' | 'grant_admin' | 'revoke_admin'

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${id}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`); else { setD(json); setError(null) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t) }, [toast])

  async function run() {
    if (!action) return
    setBusy(true); setError(null)
    const isRole = action === 'grant_admin' || action === 'revoke_admin'
    const res = await fetch(isRole ? `/api/admin/users/${id}/admin-role` : `/api/admin/users/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isRole ? { grant: action === 'grant_admin', reason } : { action, reason }),
    })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Action failed')
    else { setToast(isRole ? `Done — ${action === 'grant_admin' ? 'admin access granted (they need to sign out and back in)' : 'admin access removed'}.` : `Done — ${json.outcome}.`); setAction(null); setReason(''); await load() }
    setBusy(false)
  }

  if (!d && !error) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>
  if (!d) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  const u = d.user; const pp = d.providerProfile; const cp = d.customerProfile
  const name = pp?.business_name?.trim() || `${pp?.first_name ?? cp?.first_name ?? ''} ${pp?.last_name ?? cp?.last_name ?? ''}`.trim() || u.email
  const status: string = u.status ?? 'active'
  const COPY: Record<Action, { title: string; hint: string; danger: boolean; needsReason: boolean }> = {
    suspend: { title: 'Suspend this account', hint: 'Sign-in is blocked immediately and any provider profile is hidden from search. Bookings and payments stay as they are. Reversible.', danger: true, needsReason: true },
    reinstate: { title: 'Reinstate this account', hint: 'Sign-in works again. A provider will need re-approving in the Verification queue before they show in search.', danger: false, needsReason: true },
    close: { title: 'Close this account permanently', hint: 'Personal details are removed and sign-in is blocked for good. Bookings, payments and reviews are kept for records. Not reversible.', danger: true, needsReason: true },
    reset_password: { title: 'Send a password reset email', hint: `Goes to ${u.email}.`, danger: false, needsReason: false },
    note: { title: 'Add an internal note', hint: 'Only admins see notes.', danger: false, needsReason: true },
    grant_admin: { title: 'Give this person admin access', hint: 'They can open every admin screen, refund payments and close accounts. They must sign out and back in afterwards.', danger: true, needsReason: true },
    revoke_admin: { title: 'Remove admin access', hint: 'Takes effect on their next sign-in.', danger: true, needsReason: true },
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={14} /> All users</Link>
      <div className="flex flex-wrap items-start gap-4">
        {(pp?.profile_image_url || cp?.profile_image_url) ? <img src={pp?.profile_image_url ?? cp?.profile_image_url} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-gray-200" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{(name || '?').charAt(0).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${status === 'active' ? 'bg-green-50 text-green-700' : status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-gray-200 text-gray-700'}`}>{status}</span>
            {u.isAdmin && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"><ShieldCheck size={11} /> Admin</span>}
            {!u.authExists && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">No login account (orphan)</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><Mail size={11} /> {u.email}</span>{u.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {u.phone}</span>}
            <span>Roles: {(u.roles ?? []).join(', ')}</span><span>Joined {day(u.created_at)}</span><span>Last sign-in {u.lastSignInAt ? when(u.lastSignInAt) : 'never'}</span>
          </div>
          {u.suspension_reason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><strong>Suspended {day(u.suspended_at)}:</strong> {u.suspension_reason}</p>}
        </div>
      </div>

      {toast && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {toast}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-5">
          {pp && (
            <Card title="Provider profile">
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <div><dt className="text-gray-500">Verification</dt><dd className="font-medium capitalize text-gray-900">{pp.verification_status}</dd></div>
                <div><dt className="text-gray-500">Rating</dt><dd className="inline-flex items-center gap-1 font-medium text-gray-900"><Star size={12} className="fill-amber-400 text-amber-400" /> {Number(pp.rating_average || 0).toFixed(1)} ({pp.total_reviews ?? 0})</dd></div>
                <div><dt className="text-gray-500">Jobs completed</dt><dd className="font-medium text-gray-900">{pp.total_jobs_completed ?? 0}</dd></div>
                <div><dt className="text-gray-500">Trade</dt><dd className="font-medium capitalize text-gray-900">{pp.trade_category ?? '—'}</dd></div>
                <div><dt className="text-gray-500">Area</dt><dd className="font-medium text-gray-900">{pp.city ?? '—'}</dd></div>
                <div><dt className="text-gray-500">Stripe</dt><dd className="font-medium text-gray-900">{pp.stripe_account_status ?? 'not connected'}</dd></div>
              </dl>
              <Link href={`/admin/verification?provider=${pp.id}`} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Open in verification queue →</Link>
            </Card>
          )}

          <Card title={`Bookings (${d.bookings.length})`}>
            {d.bookings.length === 0 ? <p className="text-sm text-gray-400">No bookings.</p> : (
              <ul className="divide-y divide-gray-50 text-sm">
                {d.bookings.map((b: any) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0"><Link href={`/admin/bookings/${b.id}`} className="font-medium text-gray-900 hover:text-primary">{b.service ?? 'Booking'}</Link><p className="text-xs text-gray-400"><span className="font-mono">{b.booking_number}</span> · as {b.role} · {day(b.scheduled_date)}</p></div>
                    <div className="flex shrink-0 items-center gap-2"><span className="text-sm font-medium text-gray-700">{pounds(b.total_amount)}</span><StatusBadge status={b.status} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(d.reviewsReceived.length > 0 || d.reviewsGiven.length > 0) && (
            <Card title="Reviews">
              {d.reviewsReceived.length > 0 && <><p className="mb-1 text-xs font-semibold text-gray-500">Received</p><ul className="mb-3 space-y-1 text-sm">{d.reviewsReceived.map((r: any) => <li key={r.id} className={r.hidden_at ? 'text-gray-400 line-through' : 'text-gray-800'}><span className="text-amber-500">{'★'.repeat(r.rating)}</span> {r.review_text?.slice(0, 120) ?? <em>rating only</em>} <span className="text-xs text-gray-400">· {r.reviewer_name ?? 'Customer'}{r.is_flagged ? ' · reported' : ''}</span></li>)}</ul></>}
              {d.reviewsGiven.length > 0 && <><p className="mb-1 text-xs font-semibold text-gray-500">Written</p><ul className="space-y-1 text-sm">{d.reviewsGiven.map((r: any) => <li key={r.id} className={r.hidden_at ? 'text-gray-400 line-through' : 'text-gray-800'}><span className="text-amber-500">{'★'.repeat(r.rating)}</span> {r.review_text?.slice(0, 120) ?? <em>rating only</em>}</li>)}</ul></>}
              <Link href="/admin/reviews" className="mt-3 inline-block text-xs font-medium text-primary hover:underline">Moderate reviews →</Link>
            </Card>
          )}

          {d.disputes.length > 0 && (
            <Card title="Disputes">
              <ul className="divide-y divide-gray-50 text-sm">{d.disputes.map((x: any) => <li key={x.id} className="flex items-center justify-between py-2"><Link href={`/admin/disputes/${x.id}`} className="font-medium text-gray-900 hover:text-primary">{x.dispute_number} · {String(x.dispute_type).replace(/_/g, ' ')}</Link><span className="text-xs text-gray-500">{x.filed_by === id ? 'raised' : 'against'} · {x.status}</span></li>)}</ul>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <Card title="Actions">
            {!action ? (
              <div className="flex flex-wrap gap-1.5">
                {status === 'active' && <button onClick={() => setAction('suspend')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Suspend</button>}
                {status === 'suspended' && <button onClick={() => setAction('reinstate')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Reinstate</button>}
                {status !== 'closed' && <button onClick={() => setAction('close')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Close account</button>}
                {status !== 'closed' && u.authExists && <button onClick={() => setAction('reset_password')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Send password reset</button>}
                <button onClick={() => setAction('note')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Add note</button>
                {status === 'active' && u.authExists && (u.isAdmin
                  ? <button onClick={() => setAction('revoke_admin')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Remove admin</button>
                  : <button onClick={() => setAction('grant_admin')} className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"><ShieldCheck size={12} /> Make admin</button>)}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">{COPY[action].title}</p>
                <p className="text-xs text-gray-500">{COPY[action].hint}</p>
                {COPY[action].needsReason && <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (kept in the audit log)" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />}
                <div className="flex gap-2">
                  <button disabled={busy || (COPY[action].needsReason && !reason.trim())} onClick={run} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${COPY[action].danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}>{busy ? 'Working…' : 'Confirm'}</button>
                  <button disabled={busy} onClick={() => setAction(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Back</button>
                </div>
              </div>
            )}
          </Card>
          {u.admin_notes && <Card title="Internal notes"><p className="whitespace-pre-wrap text-xs text-gray-700">{u.admin_notes}</p></Card>}
          {d.audit.length > 0 && <Card title="Admin activity"><ul className="space-y-2 text-xs text-gray-500">{d.audit.map((a: any) => <li key={a.id}><span className="font-medium text-gray-700">{String(a.action).replace(/^user\./, '').replace(/_/g, ' ')}</span> · {when(a.created_at)}{a.reason && <span className="block text-gray-400">{a.reason}</span>}</li>)}</ul></Card>}
        </aside>
      </div>
    </div>
  )
}
