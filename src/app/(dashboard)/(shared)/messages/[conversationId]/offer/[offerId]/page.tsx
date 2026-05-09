'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api-client'

const STATUS_STYLES: Record<string, string> = {
  sent:     'bg-blue-100 text-primary',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  countered:'bg-yellow-100 text-yellow-700',
}

export default function OfferViewPage() {
  const { conversationId, offerId } = useParams<{ conversationId: string; offerId: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [offer, setOffer]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState<'accept' | 'decline' | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const activeRole = (user as any)?.user_metadata?.active_role as string | undefined
  const isProvider = activeRole === 'provider'
  const isCustomer = activeRole === 'customer'

  useEffect(() => {
    apiClient(`/api/v1/conversations/${conversationId}/offers/${offerId}`)
      .then(({ data }) => { setOffer(data?.offer ?? null); setLoading(false) })
  }, [conversationId, offerId])

  async function handleAction(action: 'accept' | 'decline') {
    setActing(action)
    setError(null)
    const { error: err } = await apiClient(
      `/api/v1/conversations/${conversationId}/offers/${offerId}/${action}`,
      { method: 'POST' },
    )
    if (err) {
      setError(err)
    } else {
      setOffer((prev: any) => ({ ...prev, status: action === 'accept' ? 'accepted' : 'declined' }))
      setTimeout(() => router.push(`/messages/${conversationId}`), 1200)
    }
    setActing(null)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!offer) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Offer not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">← Go back</button>
      </div>
    )
  }

  const milestones: any[] = offer.milestones ?? []
  const totalCents: number = offer.total_cents ?? 0
  const isPending = offer.status === 'sent'

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 px-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back to chat</button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">{error}</div>
      )}

      {/* Offer header */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Offer {offer.version > 1 ? `(v${offer.version})` : ''}
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-900">{offer.title}</h1>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[offer.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {offer.status}
          </span>
        </div>

        {offer.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{offer.description}</p>
        )}
      </div>

      {/* Milestones */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Milestones</h2>
        </div>

        <div className="divide-y divide-gray-50">
          {milestones.map((m: any, i: number) => (
            <div key={i} className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                  {m.description && <p className="mt-0.5 text-xs text-gray-500">{m.description}</p>}
                  {m.due_date && <p className="mt-0.5 text-xs text-gray-400">Due {m.due_date}</p>}
                </div>
              </div>
              <p className="shrink-0 text-sm font-bold text-gray-900">${(m.amount_cents / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between bg-gray-50 px-5 py-4 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-lg font-bold text-gray-900">${(totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      {/* Actions — customer only, only if pending */}
      {isCustomer && isPending && (
        <div className="flex gap-3">
          <button
            onClick={() => handleAction('decline')}
            disabled={!!acting}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {acting === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            onClick={() => handleAction('accept')}
            disabled={!!acting}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {acting === 'accept' ? 'Accepting…' : '✓ Accept Offer'}
          </button>
        </div>
      )}

      {/* Provider: edit offer if still pending */}
      {isProvider && isPending && (
        <button
          onClick={() => router.push(`/messages/${conversationId}/offer/${offerId}/edit`)}
          className="w-full rounded-xl border border-primary/20 py-3 text-sm font-semibold text-primary hover:bg-primary/[0.06]"
        >
          ✏️ Edit Offer
        </button>
      )}

      {offer.status === 'accepted' && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700 ring-1 ring-green-200">
          ✅ Offer accepted — contract is active
        </div>
      )}

      {offer.status === 'declined' && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600 ring-1 ring-red-200">
          This offer was declined.
        </div>
      )}
    </div>
  )
}
