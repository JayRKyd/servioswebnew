'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'

interface JobOfferPanelProps {
  conversationId: string
  conversation: any
  offer: any
  isProvider: boolean
  onOfferAction: (action: 'accept' | 'decline') => void
  /** When provided (e.g. from booking detail page), skips internal fetch and uses these directly. */
  milestones?: any[]
}

export function JobOfferPanel({
  conversationId,
  conversation,
  offer,
  isProvider,
  onOfferAction,
  milestones: milestonesProp,
}: JobOfferPanelProps) {
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedMilestones, setFetchedMilestones] = useState<any[]>([])

  const booking = conversation?.booking
  const bookingBase = isProvider ? '/provider/bookings' : '/bookings'
  const isPending = offer?.status === 'sent'

  // Self-fetch only when milestones prop is not provided (messages page / uncontrolled mode)
  useEffect(() => {
    if (milestonesProp !== undefined) return   // controlled — skip fetch
    if (!booking?.id) return
    supabase
      .from('booking_milestones')
      .select('*')
      .eq('booking_id', booking.id)
      .order('milestone_number')
      .then(({ data }) => setFetchedMilestones(data ?? []))
  }, [booking?.id, milestonesProp])

  // Use prop when controlled, otherwise use self-fetched
  const bookingMilestones = milestonesProp ?? fetchedMilestones

  async function handleAction(action: 'accept' | 'decline') {
    setActing(action)
    setError(null)
    const { error: err } = await apiClient(
      `/api/v1/conversations/${conversationId}/offers/${offer.id}/${action}`,
      { method: 'POST' },
    )
    if (err) setError(err)
    else onOfferAction(action)
    setActing(null)
  }

  const hasMilestones = bookingMilestones.length > 0
  const offerMilestones = offer?.milestones ?? []
  const showOfferMilestones = !hasMilestones && offerMilestones.length > 0

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">

      {/* ── JOB DETAILS ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Job Details
        </p>
        {booking ? (
          <>
            <h3 className="text-[15px] font-bold text-gray-900 leading-snug">
              {booking.service?.title ?? booking.booking_number}
            </h3>
            {booking.booking_number && (
              <p className="text-xs text-gray-400 mt-0.5">#{booking.booking_number}</p>
            )}
            <span className={`mt-2.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
              booking.status === 'completed'   ? 'bg-purple-100 text-purple-700' :
              booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
              booking.status === 'accepted' || booking.status === 'confirmed'
                                               ? 'bg-green-100 text-green-800' :
              booking.status === 'rejected' || booking.status === 'cancelled'
                                               ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {booking.status?.replace(/_/g, ' ')}
            </span>
          </>
        ) : (
          <p className="text-sm text-gray-400">No booking linked.</p>
        )}
      </div>

      {/* ── FINANCIALS ──────────────────────────────────────────────────────── */}
      {booking && (booking.total_amount != null || booking.base_amount != null) && (
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Financials
          </p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Gross</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency((booking.total_amount ?? booking.base_amount) / 100)}
              </span>
            </div>
            {booking.platform_fee != null && Number(booking.platform_fee) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Platform fee</span>
                <span className="text-sm font-medium text-red-500">
                  −{formatCurrency(booking.platform_fee / 100)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2.5 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">
                {isProvider ? 'You receive' : 'Total'}
              </span>
              <span className={`text-sm font-bold ${isProvider ? 'text-green-700' : 'text-gray-900'}`}>
                {formatCurrency(
                  ((booking.total_amount ?? booking.base_amount) - (booking.platform_fee ?? 0)) / 100
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULED ───────────────────────────────────────────────────────── */}
      {booking?.scheduled_date && (
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Scheduled
          </p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(booking.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            {booking.scheduled_time_start && (
              <span className="ml-3 text-gray-500">
                {booking.scheduled_time_start.slice(0, 5)}
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── MILESTONES (from booking_milestones — post-acceptance) ──────────── */}
      {hasMilestones && (
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Milestones
          </p>
          <div className="space-y-3.5">
            {bookingMilestones.map((m) => (
              <div key={m.id} className="flex items-start gap-3">
                <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {m.milestone_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 leading-tight">{m.title}</p>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {formatCurrency(Number(m.amount))}
                    </p>
                  </div>
                  {m.due_date && (
                    <p className="text-xs text-gray-500 mt-0.5">Due {m.due_date}</p>
                  )}
                  <span className={`mt-1 inline-flex items-center rounded-full px-2 py-px text-[10px] font-medium capitalize ${
                    m.status === 'active'                                    ? 'bg-blue-100 text-blue-700' :
                    m.status === 'released' || m.status === 'completed'     ? 'bg-green-100 text-green-700' :
                    m.status === 'escrowed'                                  ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MILESTONES (from offer — pre-acceptance / proposed) ─────────────── */}
      {showOfferMilestones && (
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Proposed Milestones
          </p>
          <div className="space-y-3.5">
            {offerMilestones.map((m: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="shrink-0 w-[22px] h-[22px] rounded-full bg-gray-800 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 leading-tight">{m.title}</p>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      {formatCurrency(m.amount_cents / 100)}
                    </p>
                  </div>
                  {m.due_date && (
                    <p className="text-xs text-gray-500 mt-0.5">Due {m.due_date}</p>
                  )}
                  <span className="mt-1 inline-flex items-center rounded-full px-2 py-px text-[10px] font-medium bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
          {offer.total_cents > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
              <span className="text-gray-900">Total</span>
              <span className="text-primary">{formatCurrency(offer.total_cents / 100)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state (no offer, no milestones) ───────────────────────────── */}
      {!offer && !hasMilestones && booking && (
        <div className="px-5 py-6 flex-1 flex items-start justify-center">
          <p className="text-sm text-gray-400 text-center">
            {isProvider ? 'No offer sent yet.' : 'Awaiting offer from your provider.'}
          </p>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 my-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────────── */}
      <div className="mt-auto px-5 py-4 border-t border-gray-100 space-y-2.5">

        {/* Customer: accept / decline pending offer */}
        {!isProvider && isPending && (
          <div className="flex gap-2 mb-1">
            <button
              onClick={() => handleAction('decline')}
              disabled={!!acting}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {acting === 'decline' ? '…' : 'Decline'}
            </button>
            <button
              onClick={() => handleAction('accept')}
              disabled={!!acting}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {acting === 'accept' ? '…' : 'Accept Offer'}
            </button>
          </div>
        )}

        {/* View Contract link */}
        {booking?.id && (
          <Link
            href={`${bookingBase}/${booking.id}`}
            className="block text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            View Contract →
          </Link>
        )}

        {/* Manage Milestones primary button */}
        {hasMilestones && booking?.id && (
          <Link
            href={`${bookingBase}/${booking.id}#milestones`}
            className="block w-full rounded-lg bg-gray-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Manage Milestones
          </Link>
        )}

        {/* Provider: create offer CTA (no offer, no milestones yet) */}
        {isProvider && !offer && !hasMilestones && (
          <Link
            href={`/messages/${conversationId}/offer/new`}
            className="block w-full rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            + Send Offer
          </Link>
        )}

        {/* Provider: edit offer or send new offer text link */}
        {isProvider && (offer || hasMilestones) && (
          <div className="text-center pt-0.5">
            <Link
              href={
                offer && isPending
                  ? `/messages/${conversationId}/offer/${offer.id}/edit`
                  : `/messages/${conversationId}/offer/new`
              }
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {offer && isPending ? 'Edit Offer' : '+ Send Offer'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
