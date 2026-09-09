'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type QuoteRequest = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'closed' | 'expired'
  service_type: string | null
  area: string | null
  created_at: string
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

export default function CustomerQuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [request, setRequest] = useState<QuoteRequest | null>(null)
  const [responses, setResponses] = useState<QuoteResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: qr }, { data: resps }] = await Promise.all([
      supabase.from('quote_requests').select('*').eq('id', id).eq('customer_id', user.id).maybeSingle(),
      supabase.from('quote_responses').select('*').eq('quote_request_id', id).order('amount'),
    ])
    if (!qr) { setLoading(false); return }
    setRequest(qr)

    const providerIds = (resps ?? []).map((r: any) => r.provider_id)
    let nameMap: Record<string, string> = {}
    if (providerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('provider_profiles')
        .select('user_id, business_name, first_name, last_name')
        .in('user_id', providerIds)
      for (const p of profiles ?? []) {
        nameMap[p.user_id] = p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Provider'
      }
    }
    setResponses((resps ?? []).map((r: any) => ({ ...r, _providerName: nameMap[r.provider_id] })))
    setLoading(false)
  }, [user?.id, id])

  useEffect(() => { load() }, [load])

  /** Accepting marks this response won (and the rest rejected), closes the
   *  request, notifies the provider, then hands off to the normal booking
   *  form — scheduling, validation and payment math all follow the standard
   *  path instead of duplicating booking creation here. */
  async function handleAccept(response: QuoteResponse) {
    if (!user || !request) return
    setAccepting(response.id)
    setError(null)

    const updates = responses.map((r) =>
      supabase.from('quote_responses')
        .update({ status: r.id === response.id ? 'accepted' : 'rejected' })
        .eq('id', r.id)
    )
    const results = await Promise.all(updates)
    if (results.some(r => r.error)) {
      setError('Could not accept this quote — please try again.')
      setAccepting(null)
      return
    }
    await supabase.from('quote_requests').update({ status: 'closed' }).eq('id', request.id)

    await supabase.from('notifications').insert({
      user_id: response.provider_id,
      notification_type: 'offer_accepted',
      title: 'Your quote was accepted',
      body: `Your £${Number(response.amount).toFixed(2)} quote for "${request.title}" was accepted — expect a booking request.`,
      data: { quote_request_id: request.id },
    })

    const context = `Quote accepted: £${Number(response.amount).toFixed(2)} — ${request.title}`
    router.push(`/bookings/new?provider=${response.provider_id}&context=${encodeURIComponent(context)}`)
  }

  async function handleClose() {
    if (!request) return
    setClosing(true)
    await supabase.from('quote_requests').update({ status: 'closed' }).eq('id', request.id)
    setRequest((prev) => prev ? { ...prev, status: 'closed' } : prev)
    setClosing(false)
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!request) return <div className="p-8 text-center text-gray-500">Quote request not found.</div>

  const isOpen = request.status === 'open'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push('/quotes')} className="text-sm text-primary hover:underline">← My Quotes</button>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{request.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
            <span className="capitalize">{request.status}</span>
            {request.area && <span>· {request.area}</span>}
            <span>· {new Date(request.created_at).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        {isOpen && (
          <button onClick={handleClose} disabled={closing}
            className="shrink-0 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {closing ? 'Closing…' : 'Close Request'}
          </button>
        )}
      </div>

      {request.description && (
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.description}</p>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Quotes received ({responses.length})</h2>

        {responses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            No quotes yet — matching providers have been notified and usually respond within a day.
          </div>
        ) : (
          <ul className="space-y-3">
            {responses.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/providers/${r.provider_id}`} className="font-semibold text-gray-900 hover:underline">
                      {r._providerName ?? 'Provider'}
                    </Link>
                    {r.notes && <p className="mt-1 text-sm text-gray-500">{r.notes}</p>}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      {r.estimated_hours != null && <span>{r.estimated_hours}h estimated</span>}
                      <span>{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
                    </div>
                  </div>
                  <p className="shrink-0 text-xl font-bold text-gray-900">£{Number(r.amount).toFixed(2)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (RESPONSE_STYLES[r.status] ?? 'bg-gray-100 text-gray-600')}>
                    {r.status}
                  </span>
                  {isOpen && r.status === 'pending' && (
                    <button onClick={() => handleAccept(r)} disabled={accepting !== null}
                      className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
                      {accepting === r.id ? 'Accepting…' : 'Accept & Book'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
