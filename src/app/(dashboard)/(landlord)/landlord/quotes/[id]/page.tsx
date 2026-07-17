'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

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

type QuoteResponse = {
  id: string
  provider_id: string
  amount: number
  estimated_hours: number | null
  notes: string | null
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  _providerName?: string
}

const RESPONSE_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default function LandlordQuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [responses, setResponses] = useState<QuoteResponse[]>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: qr }, { data: resps }, { data: lp }] = await Promise.all([
      supabase.from('quote_requests').select('*').eq('id', id).single(),
      supabase.from('quote_responses').select('*').eq('quote_request_id', id).order('amount'),
      supabase
        .from('landlord_profiles')
        .select('auto_approve_threshold')
        .eq('user_id', user.id)
        .single(),
    ])

    if (!qr) { setLoading(false); return }
    setRequest(qr)
    setThreshold(lp?.auto_approve_threshold ?? null)

    if (resps && resps.length > 0) {
      // Fetch provider names
      const providerIds = resps.map((r: QuoteResponse) => r.provider_id)
      const { data: profiles } = await supabase
        .from('provider_profiles')
        .select('user_id, business_name, first_name, last_name')
        .in('user_id', providerIds)

      const nameMap: Record<string, string> = {}
      ;(profiles ?? []).forEach((p: any) => {
        nameMap[p.user_id] = p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Provider'
      })

      setResponses(
        resps.map((r: QuoteResponse) => ({ ...r, _providerName: nameMap[r.provider_id] }))
      )
    } else {
      setResponses([])
    }
    setLoading(false)
  }, [user?.id, id])

  useEffect(() => { load() }, [load])

  async function handleAccept(response: QuoteResponse) {
    if (!user || !request) return
    setAccepting(response.id)
    setError(null)

    // Determine whether to auto-approve the resulting booking
    const amountCents = Math.round(response.amount * 100)
    const thresholdCents = threshold != null ? Math.floor(threshold * 100) : null
    const autoApprove = thresholdCents != null && amountCents <= thresholdCents
    const bookingStatus = autoApprove ? 'accepted' : 'pending'

    // 1. Create booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .insert({
        customer_id: user.id,
        provider_id: response.provider_id,
        property_id: request.property_id,
        service_id: request.service_id,
        landlord_id: user.id,
        total_amount: amountCents,
        status: bookingStatus,
        notes: request.description,
        scheduled_at: request.scheduled_date
          ? new Date(request.scheduled_date).toISOString()
          : null,
      })
      .select('id')
      .single()

    if (bookingErr || !booking) {
      setError(bookingErr?.message ?? 'Failed to create booking.')
      setAccepting(null)
      return
    }

    // 2. Accept this response, reject the rest
    const updates = responses.map((r) =>
      supabase
        .from('quote_responses')
        .update({ status: r.id === response.id ? 'accepted' : 'rejected' })
        .eq('id', r.id)
    )
    await Promise.all(updates)

    // 3. Close the quote request
    await supabase
      .from('quote_requests')
      .update({ status: 'closed' })
      .eq('id', request.id)

    router.push('/landlord/bookings/' + booking.id)
  }

  async function handleClose() {
    if (!request) return
    setClosing(true)
    await supabase.from('quote_requests').update({ status: 'closed' }).eq('id', request.id)
    setRequest((prev) => prev ? { ...prev, status: 'closed' } : prev)
    setClosing(false)
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  }

  if (!request) {
    return <div className="p-8 text-center text-gray-500">Quote request not found.</div>
  }

  const isOpen = request.status === 'open'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="capitalize">{request.status}</span>
            {request.scheduled_date && <span>· Preferred: {request.scheduled_date}</span>}
            <span>· {new Date(request.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        {isOpen && (
          <button
            onClick={handleClose}
            disabled={closing}
            className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {closing ? 'Closing…' : 'Close Request'}
          </button>
        )}
      </div>

      {request.description && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
        </section>
      )}

      {threshold != null && isOpen && (
        <div className="rounded-lg bg-primary/[0.06] p-4 text-sm text-gray-700 ring-1 ring-primary/30">
          Your auto-approval threshold is <strong>£{threshold.toFixed(2)}</strong>. Quotes at or
          under this amount will be automatically accepted when you select a winner.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Responses */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Responses ({responses.length})
        </h2>

        {responses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
            No responses yet. Providers have been notified.
          </div>
        ) : (
          <ul className="space-y-3">
            {responses.map((r) => {
              const autoApproveThis =
                threshold != null && r.amount <= threshold

              return (
                <li
                  key={r.id}
                  className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {r._providerName ?? 'Provider'}
                      </p>
                      {r.notes && (
                        <p className="mt-1 text-sm text-gray-500">{r.notes}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        {r.estimated_hours != null && (
                          <span>{r.estimated_hours}h estimated</span>
                        )}
                        <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900">
                        £{r.amount.toFixed(2)}
                      </p>
                      {autoApproveThis && r.status === 'pending' && (
                        <p className="text-xs text-primary font-medium mt-0.5">
                          Will auto-approve
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={
                        'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                        (RESPONSE_STYLES[r.status] ?? 'bg-gray-100 text-gray-600')
                      }
                    >
                      {r.status}
                    </span>

                    {isOpen && r.status === 'pending' && (
                      <button
                        onClick={() => handleAccept(r)}
                        disabled={accepting !== null}
                        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                      >
                        {accepting === r.id ? 'Accepting…' : 'Accept & Book'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
