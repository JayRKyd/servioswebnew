'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-orange-100 text-orange-700',
  resolved:     'bg-green-100 text-green-700',
  rejected:     'bg-gray-100 text-gray-600',
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'under_review' | 'resolved' | 'rejected'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  useEffect(() => {
    supabase
      .from('claims')
      .select('*, booking:bookings(booking_number, total_amount, service:services(title), provider:provider_profiles(first_name, last_name, business_name)), customer:customer_profiles(first_name, last_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClaims(data ?? [])
        const initNotes: Record<string, string> = {}
        ;(data ?? []).forEach((c: any) => { initNotes[c.id] = c.admin_notes ?? '' })
        setNotes(initNotes)
        setLoading(false)
      })
  }, [])

  async function handleUpdateStatus(claimId: string, status: string) {
    setSaving(claimId)
    await supabase.from('claims').update({ status, admin_notes: notes[claimId] ?? null, resolved_at: status === 'resolved' ? new Date().toISOString() : null }).eq('id', claimId)
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status, admin_notes: notes[claimId] } : c))
    setSaving(null)
  }

  const filtered = filter === 'all' ? claims : claims.filter(c => c.status === filter)
  const counts = {
    all: claims.length,
    open: claims.filter(c => c.status === 'open').length,
    under_review: claims.filter(c => c.status === 'under_review').length,
    resolved: claims.filter(c => c.status === 'resolved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workmanship Claims</h1>
          <p className="text-sm text-gray-500 mt-1">Review and resolve customer workmanship complaints</p>
        </div>
        {counts.open > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">{counts.open} open</span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'open', 'under_review', 'resolved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'pb-2 px-2 text-sm font-medium capitalize border-b-2 transition ' +
              (filter === f ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {f.replace('_', ' ')} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No claims found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(claim => {
            const booking = claim.booking
            const claimant = claim.claimant
            const provider = booking?.provider
            const providerName = provider?.business_name ?? (`${provider?.first_name ?? ''} ${provider?.last_name ?? ''}`.trim() || 'Unknown')
            const isOpen = expanded === claim.id

            return (
              <div key={claim.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                {/* Header row */}
                <button
                  className="w-full flex items-start gap-4 p-4 text-left hover:bg-gray-50 transition"
                  onClick={() => setExpanded(isOpen ? null : claim.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{booking?.booking_number ?? claim.booking_id}</p>
                      <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[claim.status] ?? 'bg-gray-100 text-gray-600')}>
                        {claim.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {booking?.service?.title ?? 'Unknown service'} · Provider: {providerName}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Filed by {claimant?.first_name} {claimant?.last_name} · {formatDate(claim.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {booking?.total_amount != null && (
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(booking.total_amount / 100)}</span>
                    )}
                    <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Customer Description</p>
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{claim.description}</p>
                    </div>

                    {claim.evidence_urls?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidence</p>
                        <div className="flex gap-2 flex-wrap">
                          {claim.evidence_urls.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer"
                              className="rounded-lg bg-primary/[0.06] px-3 py-1.5 text-xs text-primary hover:bg-blue-100">
                              View File {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Resolution Notes</label>
                      <textarea rows={3} value={notes[claim.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [claim.id]: e.target.value }))}
                        placeholder="Internal notes about resolution…"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => handleUpdateStatus(claim.id, 'under_review')} disabled={saving === claim.id}
                        className={'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ' +
                          (claim.status === 'under_review' ? 'bg-orange-600 text-white' : 'border border-orange-300 text-orange-700 hover:bg-orange-50')}>
                        Mark Under Review
                      </button>
                      <button onClick={() => handleUpdateStatus(claim.id, 'resolved')} disabled={saving === claim.id}
                        className={'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ' +
                          (claim.status === 'resolved' ? 'bg-green-600 text-white' : 'border border-green-300 text-green-700 hover:bg-green-50')}>
                        ✓ Resolve
                      </button>
                      <button onClick={() => handleUpdateStatus(claim.id, 'rejected')} disabled={saving === claim.id}
                        className={'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ' +
                          (claim.status === 'rejected' ? 'bg-gray-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50')}>
                        Reject
                      </button>
                    </div>
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
