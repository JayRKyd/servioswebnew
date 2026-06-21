'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'

interface JobOfferPanelProps {
  conversationId: string
  conversation: any
  offer: any
  isProvider: boolean
  onOfferAction: (action: 'accept' | 'decline') => void
}

export function JobOfferPanel({
  conversationId,
  conversation,
  offer,
  isProvider,
  onOfferAction,
}: JobOfferPanelProps) {
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const booking = conversation?.booking
  const bookingBase = isProvider ? '/provider/bookings' : '/bookings'

  async function handleAction(action: 'accept' | 'decline') {
    setActing(action)
    setError(null)
    const { error: err } = await apiClient(
      `/api/v1/conversations/${conversationId}/offers/${offer.id}/${action}`,
      { method: 'POST' },
    )
    if (err) {
      setError(err)
    } else {
      onOfferAction(action)
    }
    setActing(null)
  }

  const isCustomer = !isProvider
  const isPending = offer?.status === 'sent'

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Job Details Section */}
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">Job Details</h2>
        {booking ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{booking.service?.title ?? booking.booking_number}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  booking.status === 'completed' ? 'bg-purple-100 text-purple-700' :
                  booking.status === 'confirmed' || booking.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {booking.status?.replace(/_/g, ' ')}
                </span>
                {booking.booking_number && (
                  <span className="text-xs text-gray-400">#{booking.booking_number}</span>
                )}
              </div>
            </div>
            <Link href={`${bookingBase}/${booking.id}`} className="inline-block text-sm text-primary hover:underline font-medium">
              View booking details →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No booking linked.</p>
        )}
      </div>

      {/* Offer Section */}
      <div className="p-5 flex-1 overflow-y-auto">
        <h2 className="text-xs font-bold text-gray-900 mb-4 uppercase tracking-wider">Active Offer</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {!offer ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
            <p className="text-sm text-gray-500 mb-3">
              {isProvider ? 'No offer sent yet.' : 'Waiting for an offer from the provider.'}
            </p>
            {isProvider && (
              <Link
                href={`/messages/${conversationId}/offer/new`}
                className="block w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Create Offer
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Offer Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{offer.title}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  offer.status === 'declined' ? 'bg-red-100 text-red-700' :
                  offer.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {offer.status === 'sent' ? 'Pending' : offer.status}
                </span>
              </div>
              {offer.description && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{offer.description}</p>
              )}
              {offer.version > 1 && (
                <p className="text-xs text-gray-400 mt-1">Version {offer.version}</p>
              )}
            </div>

            {/* Milestones */}
            <div className="divide-y divide-gray-50">
              {(offer.milestones || []).map((m: any, i: number) => (
                <div key={i} className="p-4 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                    {m.due_date && <p className="text-xs text-gray-400 mt-0.5">Due: {m.due_date}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900">{formatCurrency(m.amount_cents / 100)}</p>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-primary">{formatCurrency((offer.total_cents || 0) / 100)}</span>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-2 bg-white">
              {isCustomer && isPending && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction('decline')}
                    disabled={!!acting}
                    className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {acting === 'decline' ? '...' : 'Decline'}
                  </button>
                  <button
                    onClick={() => handleAction('accept')}
                    disabled={!!acting}
                    className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    {acting === 'accept' ? '...' : 'Accept'}
                  </button>
                </div>
              )}

              {isProvider && isPending && (
                <Link
                  href={`/messages/${conversationId}/offer/${offer.id}/edit`}
                  className="block w-full text-center rounded-lg border border-primary/20 py-2 text-sm font-semibold text-primary hover:bg-primary/[0.06]"
                >
                  Edit Offer
                </Link>
              )}

              {offer.status === 'accepted' && (
                <div className="rounded-lg bg-green-50 py-2 text-center text-sm font-medium text-green-700 ring-1 ring-green-200">
                  Contract Active
                </div>
              )}

              {offer.status === 'declined' && (
                <div className="rounded-lg bg-red-50 py-2 text-center text-sm text-red-600 ring-1 ring-red-200">
                  Offer declined
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
