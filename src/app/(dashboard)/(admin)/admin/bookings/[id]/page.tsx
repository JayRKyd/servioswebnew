'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Mail, MessageSquare, Phone, ShieldAlert, Wrench } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'

const pounds = (p: number | null | undefined) => `£${((p ?? 0) / 100).toFixed(2)}`
const when = (iso: string | null | undefined) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const day = (iso: string | null | undefined) => iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3"><h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h2>{right}</div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [action, setAction] = useState<'cancel' | 'set_status' | 'resend_summary' | null>(null)
  const [status, setStatus] = useState('accepted')
  const [refund, setRefund] = useState(true)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bookings/${id}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`); else { setD(json); setError(null) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t) }, [toast])

  async function run() {
    if (!action) return
    setBusy(true); setError(null)
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason, status, refund }) })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? 'Action failed')
    else { setToast(`Done — ${json.outcome}.`); setAction(null); setReason(''); await load() }
    setBusy(false)
  }

  if (!d && !error) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>
  if (!d) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  const b = d.booking
  const p = d.payment
  const openDispute = d.disputes.find((x: any) => ['open', 'under_review', 'awaiting_customer', 'awaiting_provider'].includes(x.status))
  const address = typeof b.service_address === 'string' ? b.service_address : b.service_address?.formatted_address ?? [b.service_address?.line1, b.service_address?.postcode].filter(Boolean).join(', ')

  const steps = ['pending', 'accepted', 'in_progress', 'completed', 'confirmed']
  const current = b.customer_confirmed_at ? 4 : steps.indexOf(b.status)

  return (
    <div className="space-y-5">
      <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft size={14} /> All bookings</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{b.service?.title ?? 'Booking'}</h1>
            <StatusBadge status={b.status} />
            {openDispute && <Link href={`/admin/disputes/${openDispute.id}`} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white"><ShieldAlert size={11} /> {openDispute.dispute_number}</Link>}
          </div>
          <p className="mt-1 text-sm text-gray-500"><span className="font-mono">{b.booking_number}</span> · created {when(b.created_at)}</p>
        </div>
      </div>

      {/* Stepper */}
      {!['cancelled', 'rejected'].includes(b.status) && (
        <ol className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
          {['Requested', 'Accepted', 'In progress', 'Provider done', 'Customer confirmed'].map((label, i) => (
            <li key={label} className="flex items-center gap-1">
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${i < current ? 'bg-green-50 text-green-700' : i === current ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>{label}</span>
              {i < 4 && <span className="h-px w-4 bg-gray-200" />}
            </li>
          ))}
        </ol>
      )}

      {toast && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {toast}</div>}
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="space-y-5">
          <Card title="Details">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-gray-500">Scheduled</dt><dd className="font-medium text-gray-900">{day(b.scheduled_date)} {b.scheduled_time_start ? `at ${String(b.scheduled_time_start).slice(0, 5)}` : ''}</dd></div>
              <div><dt className="text-gray-500">Amount</dt><dd className="font-medium text-gray-900">{pounds(b.total_amount)} <span className="text-gray-400">· fee {pounds(b.platform_fee)}</span></dd></div>
              {address && <div className="sm:col-span-2"><dt className="text-gray-500">Address</dt><dd className="font-medium text-gray-900">{address}</dd></div>}
              {b.customer_notes && <div className="sm:col-span-2"><dt className="text-gray-500">Customer notes</dt><dd className="text-gray-800">{b.customer_notes}</dd></div>}
              {b.provider_notes && <div className="sm:col-span-2"><dt className="text-gray-500">Provider notes</dt><dd className="text-gray-800">{b.provider_notes}</dd></div>}
              {b.cancellation_reason && <div className="sm:col-span-2"><dt className="text-gray-500">Cancellation reason</dt><dd className="text-gray-800">{b.cancellation_reason}</dd></div>}
              {b.admin_notes && <div className="sm:col-span-2"><dt className="text-gray-500">Admin notes</dt><dd className="whitespace-pre-wrap rounded-lg bg-yellow-50 p-2 text-xs text-gray-700">{b.admin_notes}</dd></div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              {b.accepted_at && <span>Accepted {when(b.accepted_at)}</span>}{b.started_at && <span>Started {when(b.started_at)}</span>}{b.completed_at && <span>Provider completed {when(b.completed_at)}</span>}{b.customer_confirmed_at && <span>Customer confirmed {when(b.customer_confirmed_at)}</span>}{b.cancelled_at && <span>Cancelled {when(b.cancelled_at)}</span>}
            </div>
          </Card>

          <Card title="Booking chat" right={<button onClick={() => setShowChat(v => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-primary">{showChat ? <>Hide <ChevronUp size={13} /></> : <>Show {d.chat.length} <ChevronDown size={13} /></>}</button>}>
            {!showChat ? <p className="text-sm text-gray-500">Read-only copy of the customer–provider conversation.</p> : d.chat.length === 0 ? <p className="text-sm text-gray-400">No messages.</p> : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {d.chat.map((m: any) => (
                  <div key={m.id} className={`flex ${m.fromCustomer ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.fromCustomer ? 'bg-gray-100 text-gray-800' : 'bg-primary/10 text-gray-900'}`}><p className="text-[11px] text-gray-500">{m.fromCustomer ? b.customer?.first_name : 'Provider'} · {when(m.createdAt)}</p><p className="whitespace-pre-wrap">{m.body}</p></div></div>
                ))}
              </div>
            )}
          </Card>

          {d.photos.length > 0 && (
            <Card title="Job photos">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {d.photos.map((ph: any) => ph.url && <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-lg ring-1 ring-gray-200"><img src={ph.url} alt={ph.type} className="h-full w-full object-cover" /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">{ph.type}</span></a>)}
              </div>
            </Card>
          )}

          {d.disputes.length > 0 && (
            <Card title="Disputes">
              <ul className="divide-y divide-gray-50 text-sm">
                {d.disputes.map((x: any) => <li key={x.id} className="flex items-center justify-between py-2"><Link href={`/admin/disputes/${x.id}`} className="font-medium text-gray-900 hover:text-primary">{x.dispute_number} · {String(x.dispute_type).replace(/_/g, ' ')}</Link><span className="text-xs text-gray-500">{x.status}{x.resolution_type ? ` · ${String(x.resolution_type).replace(/_/g, ' ')}` : ''}{Number(x.held_amount) > 0 ? ` · ${pounds(x.held_amount)} held` : ''}</span></li>)}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6">
          <Card title="People">
            {[['Customer', b.customer, `/admin/users/${b.customer?.user_id}`], ['Provider', b.provider, `/admin/users/${b.provider?.user_id}`]].map(([label, person, href]: any) => person ? (
              <div key={label} className="mb-3 last:mb-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <Link href={href} className="text-sm font-semibold text-gray-900 hover:text-primary">{person.business_name?.trim() || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Unnamed'}</Link>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">{person.email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {person.email}</span>}{label === 'Provider' && person.stripe_account_status && <span className="inline-flex items-center gap-1"><Wrench size={11} /> Stripe {person.stripe_account_status}</span>}</div>
              </div>
            ) : <p key={label} className="text-sm text-gray-400">No {String(label).toLowerCase()}</p>)}
            {d.conversationId && <Link href={`/messages/${d.conversationId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><MessageSquare size={12} /> Open conversation</Link>}
          </Card>

          <Card title="Payment">
            {!p ? <p className="text-sm text-gray-500">No payment created — the customer hasn’t authorised a card.</p> : (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="capitalize text-gray-900">{p.payment_status.replace('_', ' ')}{p.payment_intent_id?.startsWith('sim_') ? ' (simulated)' : ''}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Charged</dt><dd className="text-gray-900">{pounds(p.amount)}</dd></div>
                {Number(p.refund_amount) > 0 && <div className="flex justify-between"><dt className="text-gray-500">Refunded</dt><dd className="text-gray-900">{pounds(p.refund_amount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-gray-500">Commission</dt><dd className="text-gray-900">{pounds(p.platform_fee_amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Provider share</dt><dd className="text-gray-900">{pounds(p.provider_payout_amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Transferred</dt><dd className="text-gray-900">{pounds(Number(p.transferred_amount ?? 0) - Number(p.reversed_amount ?? 0))}</dd></div>
                {p.captured_at && <div className="flex justify-between"><dt className="text-gray-500">Captured</dt><dd className="text-gray-900">{when(p.captured_at)}</dd></div>}
                {p.payment_intent_id && !p.payment_intent_id.startsWith('sim_') && <p className="pt-1 font-mono text-[11px] text-gray-400">{p.payment_intent_id}</p>}
              </dl>
            )}
          </Card>

          <Card title="Actions">
            {!action ? (
              <div className="flex flex-wrap gap-1.5">
                {!['cancelled', 'rejected'].includes(b.status) && <button onClick={() => setAction('cancel')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Cancel booking</button>}
                <button onClick={() => setAction('set_status')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Change status</button>
                <button onClick={() => setAction('resend_summary')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Email both sides</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">{action === 'cancel' ? 'Cancel this booking' : action === 'set_status' ? 'Set the status' : 'Email a status summary to both sides'}</p>
                {action === 'cancel' && (
                  <>
                    <p className="text-xs text-gray-500">Any card hold is released automatically and both sides are emailed.</p>
                    {p && ['succeeded', 'partially_refunded'].includes(p.payment_status) && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={refund} onChange={e => setRefund(e.target.checked)} className="accent-[#115e56]" /> Refund the customer the remaining {pounds(Number(p.amount) - Number(p.refund_amount ?? 0))}</label>}
                  </>
                )}
                {action === 'set_status' && (
                  <>
                    <p className="text-xs text-gray-500">For unsticking a booking. Setting anything other than Completed clears the customer’s confirmation. Payment is untouched.</p>
                    <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{['pending', 'accepted', 'in_progress', 'completed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
                  </>
                )}
                <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder={action === 'resend_summary' ? 'Optional note included in the email' : 'Reason (required — recorded on the booking)'} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex gap-2">
                  <button disabled={busy || !reason.trim()} onClick={run} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-dark'}`}>{busy ? 'Working…' : 'Confirm'}</button>
                  <button disabled={busy} onClick={() => setAction(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Back</button>
                </div>
              </div>
            )}
          </Card>

          {d.audit.length > 0 && (
            <Card title="Admin activity">
              <ul className="space-y-2 text-xs text-gray-500">{d.audit.map((a: any) => <li key={a.id}><span className="font-medium text-gray-700">{String(a.action).replace(/^booking\./, '').replace(/_/g, ' ')}</span> · {when(a.created_at)}{a.reason && <span className="block text-gray-400">{a.reason}</span>}</li>)}</ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
