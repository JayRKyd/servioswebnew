'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { Pencil } from 'lucide-react'

type QuoteRequest = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'closed' | 'expired'
  scheduled_date: string | null
  created_at: string
  property_id: string | null
  service_id: string | null
}

type MyResponse = {
  id: string
  amount: number
  estimated_hours: number | null
  notes: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default function ProviderQuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [myResponse, setMyResponse] = useState<MyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Auto-dismiss toast
  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => setSubmitted(false), 3000)
      return () => clearTimeout(t)
    }
  }, [submitted])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: qr }, { data: resp }] = await Promise.all([
        supabase.from('quote_requests').select('*').eq('id', id).maybeSingle(),
        supabase.from('quote_responses').select('*').eq('quote_request_id', id).eq('provider_id', user.id).maybeSingle(),
      ])
      setRequest(qr ?? null)
      setMyResponse(resp ?? null)
      if (resp) {
        setAmount(resp.amount.toString())
        setEstimatedHours(resp.estimated_hours?.toString() ?? '')
        setNotes(resp.notes ?? '')
        setEditing(false)
      } else {
        setEditing(true)
      }
    } finally {
      setLoading(false)
    }
  }, [user?.id, id])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)
    setError(null)

    const payload = {
      quote_request_id: id,
      provider_id: user.id,
      amount: parseFloat(amount),
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      notes: notes || null,
      status: 'pending',
    }

    const { error: err } = myResponse
      ? await supabase.from('quote_responses').update(payload).eq('id', myResponse.id)
      : await supabase.from('quote_responses').insert(payload)

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
    load()
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!request) return <div className="p-8 text-center text-gray-500">Quote request not found.</div>

  const canRespond = request.status === 'open'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="mb-4 text-sm text-primary hover:underline">
          ← Back to Quote Requests
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
          <span className="capitalize">{request.status}</span>
          {request.scheduled_date && <span>· Preferred: {formatDate(request.scheduled_date)}</span>}
          <span>· Posted {formatDate(request.created_at)}</span>
        </div>
      </div>

      {/* Job description */}
      {request.description && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Job Description</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
        </section>
      )}

      {/* Quote card — single card, toggles between read-only and edit */}
      {canRespond && (
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {myResponse ? 'Your Quote' : 'Submit Your Quote'}
            </h2>
            <div className="flex items-center gap-2">
              {myResponse && (
                <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_STYLES[myResponse.status] ?? '')}>
                  {myResponse.status}
                </span>
              )}
              {myResponse && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
          </div>

          {/* Toast */}
          {submitted && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Quote {myResponse ? 'updated' : 'submitted'} successfully.
            </div>
          )}

          {/* Read-only view */}
          {myResponse && !editing && (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">£{myResponse.amount.toFixed(2)}</span>
                {myResponse.estimated_hours != null && (
                  <span className="text-sm text-gray-500">· {myResponse.estimated_hours}h estimated</span>
                )}
              </div>
              {myResponse.notes && <p className="text-sm text-gray-600">{myResponse.notes}</p>}
              <p className="text-xs text-gray-400">Submitted {formatDate(myResponse.created_at)}</p>
              {myResponse.status === 'accepted' && (
                <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
                  <p className="font-medium">Congratulations — your quote was accepted!</p>
                  <p className="mt-0.5 text-green-700">A booking has been created. Check your bookings for details.</p>
                </div>
              )}
              {myResponse.status === 'rejected' && (
                <p className="text-sm text-gray-500">Your quote was not selected for this job. Better luck next time.</p>
              )}
            </div>
          )}

          {/* Edit / submit form */}
          {editing && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Your price (£) *</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">£</span>
                  <input
                    required type="number" min="1" step="0.01"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Estimated hours</label>
                <input
                  type="number" min="0.5" step="0.5"
                  value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Describe your approach, materials included, availability, etc."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                {myResponse && (
                  <button type="button" onClick={() => setEditing(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={submitting}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
                  {submitting ? 'Submitting…' : myResponse ? 'Update Quote' : 'Submit Quote'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {!canRespond && myResponse && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Your Quote</h2>
            <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_STYLES[myResponse.status] ?? '')}>
              {myResponse.status}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">£{myResponse.amount.toFixed(2)}</span>
            {myResponse.estimated_hours != null && (
              <span className="text-sm text-gray-500">· {myResponse.estimated_hours}h estimated</span>
            )}
          </div>
          {myResponse.notes && <p className="text-sm text-gray-600">{myResponse.notes}</p>}
          <p className="text-xs text-gray-400">Submitted {formatDate(myResponse.created_at)}</p>
        </section>
      )}

      {!canRespond && !myResponse && (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          This quote request is no longer accepting responses.
        </div>
      )}
    </div>
  )
}
