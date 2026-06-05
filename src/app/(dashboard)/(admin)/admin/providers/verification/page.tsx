'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'
import { docTypeLabel, BADGE_LABELS } from '@/lib/document-requirements'

export default function ProviderVerificationPage() {
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function load() {
    const { data: providerData } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('verification_status', 'pending')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (!providerData || providerData.length === 0) {
      setProviders([])
      setLoading(false)
      return
    }

    // Fetch documents for each provider
    const userIds = providerData.map((p: any) => p.user_id)
    const { data: allDocs } = await supabase
      .from('provider_documents')
      .select('*')
      .in('provider_id', userIds)
      .order('created_at', { ascending: false })

    const docsByProvider: Record<string, any[]> = {}
    ;(allDocs ?? []).forEach((d: any) => {
      if (!docsByProvider[d.provider_id]) docsByProvider[d.provider_id] = []
      docsByProvider[d.provider_id].push(d)
    })

    setProviders(providerData.map((p: any) => ({
      ...p,
      documents: docsByProvider[p.user_id] ?? [],
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function verifyDoc(docId: string, providerId: string) {
    setActing(docId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('provider_documents')
      .update({ status: 'approved', verified_at: new Date().toISOString(), verified_by: user?.id })
      .eq('id', docId)
    setProviders(prev => prev.map(p => p.user_id === providerId
      ? { ...p, documents: p.documents.map((d: any) => d.id === docId ? { ...d, status: 'approved', verified_at: new Date().toISOString() } : d) }
      : p
    ))
    setActing(null)
  }

  async function approveProvider(userId: string) {
    setActing(userId)
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
    setActing(null)
  }

  async function rejectProvider(userId: string) {
    setActing(userId)
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
    setActing(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Verification Queue</h1>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No providers pending verification</p>
        </div>
      ) : (
        <div className="space-y-6">
          {providers.map(p => {
            const approvedDocs = (p.documents ?? []).filter((d: any) => d.status === 'approved')
            return (
              <div key={p.id} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
                {/* Provider header */}
                <div className="flex items-start gap-4">
                  {p.profile_image_url ? (
                    <img src={p.profile_image_url} alt={p.business_name} className="h-14 w-14 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
                      {(p.business_name ?? p.first_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-gray-900">{p.business_name}</p>
                    <p className="text-sm text-gray-500">{p.first_name} {p.last_name}</p>
                    {p.trade_category && <p className="text-xs text-gray-400 capitalize mt-0.5">{p.trade_category.replace(/_/g, ' ')}</p>}
                  </div>
                  <p className="text-xs text-gray-400 shrink-0">Applied {formatDate(p.created_at)}</p>
                </div>

                {p.bio && <p className="text-sm text-gray-600 border-t pt-4">{p.bio}</p>}

                <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                  {p.hourly_rate && <div><p className="text-xs text-gray-400">Rate</p><p className="font-medium">£{p.hourly_rate}/hr</p></div>}
                  {p.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{p.phone}</p></div>}
                  {p.service_areas?.length > 0 && <div><p className="text-xs text-gray-400">Areas</p><p className="font-medium">{p.service_areas.join(', ')}</p></div>}
                </div>

                {/* Documents */}
                {p.documents.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded Documents</p>
                    {p.documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{doc.title || docTypeLabel(doc.document_type)}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{docTypeLabel(doc.document_type)}</span>
                            {doc.expiry_date && <span className="text-xs text-gray-400">· Expires {formatDate(doc.expiry_date)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">
                              View
                            </a>
                          )}
                          {doc.status === 'approved' ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              ✓ {BADGE_LABELS[doc.document_type] ?? 'Approved'}
                            </span>
                          ) : (
                            <button
                              onClick={() => verifyDoc(doc.id, p.user_id)}
                              disabled={acting === doc.id}
                              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {acting === doc.id ? '…' : 'Verify'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {approvedDocs.length > 0 && (
                      <p className="text-xs text-gray-400">{approvedDocs.length}/{p.documents.length} documents verified</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 border-t pt-4">
                  <button
                    onClick={() => approveProvider(p.user_id)}
                    disabled={!!acting}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve Provider
                  </button>
                  <button
                    onClick={() => rejectProvider(p.user_id)}
                    disabled={!!acting}
                    className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
