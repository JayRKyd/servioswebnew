'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  pending:       'bg-yellow-100 text-yellow-700',
  investigating: 'bg-blue-100 text-primary',
  resolved:      'bg-green-100 text-green-700',
  closed:        'bg-gray-100 text-gray-500',
}

const OUTCOME_LABELS: Record<string, string> = {
  refund:  'Full refund',
  partial: 'Partial refund',
  redo:    'Redo the work',
  dismiss: 'Dismiss',
}

interface Dispute {
  id: string
  dispute_number: string
  booking_id: string
  dispute_type: string
  dispute_reason: string | null
  desired_outcome: string | null
  desired_amount: number | null
  evidence_urls: string[] | null
  evidence_description: string | null
  status: string
  priority: string | null
  resolution_type: string | null
  resolution_notes: string | null
  resolution_amount: number | null
  filed_at: string
  booking?: { booking_number: string; service?: { title: string } } | null
}

export default function ProviderDisputesPage() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [responseText, setResponseText] = useState<Record<string, string>>({})
  const [editingResponse, setEditingResponse] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    supabase
      .from('disputes')
      .select(`
        *,
        booking:bookings(booking_number, service:services(title))
      `)
      .eq('filed_against', user.id)
      .order('filed_at', { ascending: false })
      .then(({ data }) => {
        setDisputes(data ?? [])
        setLoading(false)
      })
  }, [user?.id])

  async function submitResponse(disputeId: string) {
    const text = responseText[disputeId]?.trim()
    if (!text) return
    setSaving(disputeId)
    const { error } = await supabase
      .from('disputes')
      .update({ evidence_description: text })
      .eq('id', disputeId)
    if (!error) {
      setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, evidence_description: text } : d))
      setEditingResponse(null)
      setSaved(disputeId)
      setTimeout(() => setSaved(null), 3000)
    }
    setSaving(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Disputes are filed by customers when they believe work wasn&apos;t completed satisfactorily. Respond promptly to help reach a fair resolution.
        </p>
      </div>

      {disputes.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No disputes filed against you</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(dispute => {
            const isOpen = expanded === dispute.id
            return (
              <div key={dispute.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : dispute.id)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{dispute.dispute_number}</p>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[dispute.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {dispute.status}
                        </span>
                        {dispute.priority === 'high' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">High priority</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {dispute.booking?.booking_number && `Booking ${dispute.booking.booking_number}`}
                        {dispute.booking?.service?.title && ` · ${dispute.booking.service.title}`}
                        {` · Filed ${formatDate(dispute.filed_at)}`}
                      </p>
                      <p className="text-xs text-gray-600 capitalize">
                        Type: {dispute.dispute_type?.replace(/_/g, ' ')}
                        {dispute.desired_outcome && ` · Customer wants: ${OUTCOME_LABELS[dispute.desired_outcome] ?? dispute.desired_outcome}`}
                        {dispute.desired_amount && ` (£${(Number(dispute.desired_amount) / 100).toFixed(2)})`}
                      </p>
                    </div>
                    <span className="shrink-0 text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                    {/* Customer's account */}
                    {dispute.dispute_reason && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Customer&apos;s account</p>
                        <p className="text-sm text-gray-700">{dispute.dispute_reason}</p>
                      </div>
                    )}

                    {/* Resolution (if resolved) */}
                    {dispute.resolution_type && (
                      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                        <p className="text-xs font-semibold uppercase text-green-700 mb-1">Resolution</p>
                        <p className="text-sm text-green-900 capitalize">{OUTCOME_LABELS[dispute.resolution_type] ?? dispute.resolution_type}</p>
                        {dispute.resolution_amount && (
                          <p className="text-sm text-green-700">Amount: £{(Number(dispute.resolution_amount) / 100).toFixed(2)}</p>
                        )}
                        {dispute.resolution_notes && (
                          <p className="text-sm text-green-700 mt-1">{dispute.resolution_notes}</p>
                        )}
                      </div>
                    )}

                    {/* Provider's response */}
                    {dispute.evidence_description && editingResponse !== dispute.id ? (
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Your response</p>
                        <div className="rounded-lg border-l-4 border-primary/40 bg-primary/[0.04] px-4 py-3">
                          <p className="text-sm text-gray-700">{dispute.evidence_description}</p>
                        </div>
                        {dispute.status === 'pending' && (
                          <button
                            onClick={() => {
                              setResponseText(prev => ({ ...prev, [dispute.id]: dispute.evidence_description! }))
                              setEditingResponse(dispute.id)
                            }}
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                          >
                            Edit response
                          </button>
                        )}
                      </div>
                    ) : (dispute.status !== 'resolved' && dispute.status !== 'closed') ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-gray-400">Your response</p>
                        {!dispute.evidence_description && (
                          <p className="text-xs text-gray-500">
                            Provide your account of events. Be factual and professional — this will be reviewed by the Servios team.
                          </p>
                        )}
                        <textarea
                          rows={4}
                          value={responseText[dispute.id] ?? ''}
                          onChange={e => setResponseText(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                          placeholder="Describe the work you completed, any communications with the customer, and why you believe the dispute should be resolved in your favour…"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex items-center gap-3">
                          {editingResponse === dispute.id && (
                            <button
                              onClick={() => setEditingResponse(null)}
                              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => submitResponse(dispute.id)}
                            disabled={!responseText[dispute.id]?.trim() || saving === dispute.id}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                          >
                            {saving === dispute.id ? 'Submitting…' : editingResponse === dispute.id ? 'Update response' : 'Submit response'}
                          </button>
                          {saved === dispute.id && (
                            <span className="text-sm text-green-600">Response saved</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <span className="font-medium">Need help?</span> Contact{' '}
        <a href="mailto:disputes@servios.co.uk" className="text-primary hover:underline">disputes@servios.co.uk</a>
        {' '}— our team aims to resolve disputes within 3–5 business days.
      </div>
    </div>
  )
}
