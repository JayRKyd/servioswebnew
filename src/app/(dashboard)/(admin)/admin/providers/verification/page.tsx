'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { titleCase } from '@/lib/utils'
import {
  Shield, Award, BadgeCheck, CreditCard, FileText, File,
  Eye, Check, X, AlertTriangle, Clock,
} from 'lucide-react'

const DOC_TYPE_META: Record<string, { label: string; color: string }> = {
  insurance:     { label: 'Insurance',     color: 'bg-primary/10 text-primary' },
  license:       { label: 'License',       color: 'bg-purple-100 text-purple-700' },
  certification: { label: 'Certification', color: 'bg-indigo-100 text-indigo-700' },
  id:            { label: 'ID',            color: 'bg-teal-100 text-teal-700' },
  contract:      { label: 'Contract',      color: 'bg-orange-100 text-orange-700' },
  other:         { label: 'Other',         color: 'bg-gray-100 text-gray-600' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ─── Document review card ─── */
function DocReviewCard({
  doc,
  onAction,
}: {
  doc: any
  onAction: (docId: string, action: 'verified' | 'rejected', reason?: string) => Promise<void>
}) {
  const [acting, setActing] = useState<'verified' | 'rejected' | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')

  const meta = DOC_TYPE_META[doc.document_type] ?? DOC_TYPE_META.other
  const provider = doc.provider
  const providerName = provider?.business_name
    ? `${titleCase(provider.business_name)} (${titleCase(provider.first_name ?? '')} ${titleCase(provider.last_name ?? '')})`
    : `${titleCase(provider?.first_name ?? '')} ${titleCase(provider?.last_name ?? '')}`.trim() || 'Unknown provider'

  async function handleApprove() {
    setActing('verified')
    await onAction(doc.id, 'verified')
    setActing(null)
  }

  async function handleReject() {
    if (!reason.trim()) return
    setActing('rejected')
    await onAction(doc.id, 'rejected', reason.trim())
    setActing(null)
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{doc.title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{providerName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <Clock size={10} /> Pending
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
          <p className="text-gray-700">{formatDate(doc.created_at)}</p>
        </div>
        {doc.expiry_date && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Expiry</p>
            <p className="text-gray-700">{formatDate(doc.expiry_date)}</p>
          </div>
        )}
      </div>

      {/* View file */}
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary transition-colors"
        >
          <Eye size={13} /> View document file
        </a>
      )}
      {!doc.file_url && (
        <p className="text-xs text-gray-400 italic">No file uploaded — text record only</p>
      )}

      {/* Reject reason input */}
      {showReject && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Rejection reason
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Document is expired, unreadable, or not the correct type."
            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 border-t pt-4">
        <button
          onClick={handleApprove}
          disabled={!!acting}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Check size={14} /> {acting === 'verified' ? 'Approving…' : 'Approve'}
        </button>

        {showReject ? (
          <>
            <button
              onClick={handleReject}
              disabled={!!acting || !reason.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <X size={14} /> {acting === 'rejected' ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason('') }}
              disabled={!!acting}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowReject(true)}
            disabled={!!acting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <X size={14} /> Reject
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Main page ─── */
export default function ProviderVerificationPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'providers' | 'documents'>('providers')

  // Provider queue state
  const [providers, setProviders] = useState<any[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [actingProvider, setActingProvider] = useState<string | null>(null)

  // Document queue state
  const [pendingDocs, setPendingDocs] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  useEffect(() => {
    supabase
      .from('provider_profiles')
      .select('*')
      .eq('is_verified', false)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setProviders(data ?? []); setLoadingProviders(false) })

    supabase
      .from('provider_documents')
      .select('*, provider:provider_profiles(first_name, last_name, business_name, user_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => { setPendingDocs(data ?? []); setLoadingDocs(false) })
  }, [])

  /* ── Provider actions ── */
  async function verifyProvider(userId: string) {
    setActingProvider(userId)
    await supabase.from('provider_profiles').update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verification_status: 'verified',
    }).eq('user_id', userId)
    await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: 'account_verified',
      title: 'Your account has been verified!',
      body: "Congratulations! Your provider account is now verified and you're live on Servios.",
    })
    setProviders(ps => ps.filter(p => p.user_id !== userId))
    setActingProvider(null)
  }

  async function rejectProvider(userId: string) {
    setActingProvider(userId)
    await supabase.from('provider_profiles').update({
      is_active: false,
      verification_status: 'rejected',
    }).eq('user_id', userId)
    await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: 'account_rejected',
      title: 'Verification unsuccessful',
      body: 'Your provider application was not approved. Please contact support for more information.',
    })
    setProviders(ps => ps.filter(p => p.user_id !== userId))
    setActingProvider(null)
  }

  /* ── Document actions ── */
  async function handleDocAction(
    docId: string,
    action: 'verified' | 'rejected',
    reason?: string,
  ) {
    const doc = pendingDocs.find(d => d.id === docId)
    if (!doc) return

    const updates: Record<string, any> = {
      status: action,
      ...(action === 'verified'
        ? { verified_at: new Date().toISOString(), verified_by: user?.id ?? null }
        : { rejection_reason: reason ?? null }),
    }

    await supabase.from('provider_documents').update(updates).eq('id', docId)

    const providerUserId = doc.provider?.user_id
    if (providerUserId) {
      if (action === 'verified') {
        await supabase.from('notifications').insert({
          user_id: providerUserId,
          notification_type: 'document_verified',
          title: 'Document approved',
          body: `Your document "${doc.title}" has been verified.`,
        })
      } else {
        await supabase.from('notifications').insert({
          user_id: providerUserId,
          notification_type: 'document_rejected',
          title: 'Document not approved',
          body: reason
            ? `Your document "${doc.title}" was rejected: ${reason}`
            : `Your document "${doc.title}" was not approved. Please resubmit with the correct document.`,
        })
      }
    }

    setPendingDocs(ds => ds.filter(d => d.id !== docId))
  }

  const TAB_CLASSES = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
        : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Verification Queue</h1>
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          <button onClick={() => setTab('providers')} className={TAB_CLASSES(tab === 'providers')}>
            Providers
            {providers.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {providers.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab('documents')} className={TAB_CLASSES(tab === 'documents')}>
            Documents
            {pendingDocs.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingDocs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Providers tab ── */}
      {tab === 'providers' && (
        loadingProviders
          ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          : providers.length === 0
          ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">No providers pending verification</p>
            </div>
          : <div className="space-y-4">
              {providers.map(p => (
                <div key={p.id} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{p.business_name ? titleCase(p.business_name) : ''}</p>
                    <p className="text-sm text-gray-500">{titleCase(p.first_name ?? '')} {titleCase(p.last_name ?? '')}</p>
                    {p.bio && <p className="mt-2 text-sm text-gray-600">{p.bio}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {p.hourly_rate && <div><p className="text-xs text-gray-400">Rate</p><p>£{p.hourly_rate}/hr</p></div>}
                    {p.phone && <div><p className="text-xs text-gray-400">Phone</p><p>{p.phone}</p></div>}
                  </div>
                  <div className="flex gap-3 border-t pt-4">
                    <button
                      onClick={() => verifyProvider(p.user_id)}
                      disabled={actingProvider === p.user_id}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectProvider(p.user_id)}
                      disabled={actingProvider === p.user_id}
                      className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* ── Documents tab ── */}
      {tab === 'documents' && (
        loadingDocs
          ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          : pendingDocs.length === 0
          ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400">No documents pending review</p>
            </div>
          : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {pendingDocs.map(doc => (
                <DocReviewCard key={doc.id} doc={doc} onAction={handleDocAction} />
              ))}
            </div>
      )}
    </div>
  )
}
