                                                                                                                                                                                             'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useSmartReplies } from '@/hooks/useSmartReplies'
import { SmartReplySuggestions } from '@/components/shared/SmartReplySuggestions'
import { formatCurrency } from '@/lib/utils'
import { apiClient } from '@/lib/api-client'

// ─── System message card ───────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: string; label: (m: string) => string; color: string }> = {
  offer_sent:       { icon: '📋', label: () => 'Sent an offer',          color: 'border-primary/20 bg-primary/[0.06]' },
  offer_updated:    { icon: '✏️',  label: () => 'Updated the offer',      color: 'border-primary/20 bg-primary/[0.06]' },
  offer_accepted:   { icon: '✅', label: () => 'Accepted the offer',     color: 'border-green-200 bg-green-50' },
  offer_declined:   { icon: '❌', label: () => 'Declined the offer',     color: 'border-red-200 bg-red-50' },
  payment_released: { icon: '💸', label: () => 'Released payment',       color: 'border-green-200 bg-green-50' },
  milestone_complete: { icon: '🏁', label: () => 'Marked milestone complete', color: 'border-purple-200 bg-purple-50' },
}

function SystemMessageCard({ msg, conversationId, isProvider }: { msg: any; conversationId: string; isProvider: boolean }) {
  const meta = EVENT_META[msg.message_type]
  if (!meta) return null

  const md = msg.metadata ?? {}
  const isOfferEvent   = ['offer_sent', 'offer_updated', 'offer_accepted', 'offer_declined'].includes(msg.message_type)
  const isPayment      = msg.message_type === 'payment_released'
  const isMilestone    = msg.message_type === 'milestone_complete'
  const bookingBase    = isProvider ? '/provider/bookings' : '/bookings'

  const href = isOfferEvent && md.offer_id
    ? `/messages/${conversationId}/offer/${md.offer_id}`
    : md.booking_id && (isPayment || isMilestone)
    ? `${bookingBase}/${md.booking_id}`
    : null

  return (
    <div className={`mx-auto max-w-sm rounded-xl border px-4 py-3 text-center ${meta.color}`}>
      <p className="text-sm font-semibold text-gray-800">
        {meta.icon} {md.title ? `"${md.title}"` : meta.label(msg.content)}
      </p>
      {(md.total_cents || md.amount_cents) && (
        <p className="mt-0.5 text-xs text-gray-500">
          ${((md.total_cents ?? md.amount_cents) / 100).toFixed(2)}
        </p>
      )}
      {href && (
        <Link href={href} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
          {isOfferEvent ? (msg.message_type === 'offer_accepted' ? 'View contract →' : 'View offer →') : 'View details →'}
        </Link>
      )}
    </div>
  )
}

// ─── Job Side Panel ──────────────────────────────────────────────────────────────

function JobSidePanel({ conversation, offer, isProvider, onOfferAction }: { conversation: any, offer: any, isProvider: boolean, onOfferAction: (action: 'accept' | 'decline') => void }) {
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const booking = conversation?.booking
  const bookingBase = isProvider ? '/provider/bookings' : '/bookings'

  async function handleAction(action: 'accept' | 'decline') {
    setActing(action)
    setError(null)
    const { error: err } = await apiClient(
      `/api/v1/conversations/${conversation.id}/offers/${offer.id}/${action}`,
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
                  booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {booking.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400">#{booking.booking_number}</span>
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
                href={`/messages/${conversation.id}/offer/new`}
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
                  {offer.status}
                </span>
              </div>
              {offer.version > 1 && (
                <p className="text-xs text-gray-400">Version {offer.version}</p>
              )}
            </div>

            {/* Milestones */}
            <div className="divide-y divide-gray-50">
              {(offer.milestones || []).map((m: any, i: number) => (
                <div key={i} className="p-4 flex justify-between items-start gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    {m.due_date && <p className="text-xs text-gray-500 mt-0.5">Due: {m.due_date}</p>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(m.amount_cents / 100)}</p>
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
                  href={`/messages/${conversation.id}/offer/${offer.id}/edit`}
                  className="block w-full text-center rounded-lg border border-primary/20 py-2 text-sm font-semibold text-primary hover:bg-primary/[0.06]"
                >
                  Edit Offer
                </Link>
              )}

              {offer.status === 'accepted' && (
                <div className="rounded-lg bg-green-50 py-2 text-center text-sm font-medium text-green-700">
                  Contract Active
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main chat page ────────────────────────────────────────────────────────────

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [messages, setMessages]   = useState<any[]>([])
  const [text, setText]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(false)
  const [conversation, setConversation] = useState<any>(null)
  const [otherParty, setOtherParty] = useState<{ name: string } | null>(null)
  const [offer, setOffer]         = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeRole = (user as any)?.user_metadata?.active_role as string | undefined
  const isProvider = activeRole === 'provider'

  // ── Load conversation + messages + offer ──────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return

    async function load() {
      const [{ data: conv }, { data: msgs }, { data: offerData }] = await Promise.all([
        supabase.from('conversations').select('*, booking:bookings(id, booking_number, status, service:services(title))').eq('id', conversationId).single(),
        supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
        supabase.from('job_offers').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      setConversation(conv)
      setMessages(msgs ?? [])
      setOffer(offerData)

      if (conv) {
        if (isProvider) {
          const { data: cp } = await supabase
            .from('customer_profiles')
            .select('first_name, last_name')
            .eq('user_id', conv.customer_id)
            .single()
          setOtherParty({ name: cp ? `${cp.first_name} ${cp.last_name}`.trim() || 'Customer' : 'Customer' })
        } else {
          const { data: pp } = await supabase
            .from('provider_profiles')
            .select('first_name, last_name, business_name')
            .eq('user_id', conv.provider_id)
            .single()
          setOtherParty({ name: pp ? (pp.business_name || `${pp.first_name} ${pp.last_name}`.trim() || 'Provider') : 'Provider' })
        }
      }

      setLoading(false)
    }
    load()
  }, [conversationId, isProvider])

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new]),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_offers', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setOffer(payload.new)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Smart replies
  const lastIncoming = messages.filter((m) => m.sender_id !== user?.id && m.message_type === 'text').at(-1)
  const suggestions  = useSmartReplies(lastIncoming ? { lastMessage: lastIncoming.message_text } : null)

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || sending) return
    const content = text
    setText('')
    setSending(true)
    const { data } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: user.id, message_text: content, message_type: 'text' })
      .select()
      .single()
    if (data) setMessages((m) => [...m, data])
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
    setSending(false)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-row">
      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {otherParty?.name ?? (isProvider ? 'Customer' : 'Provider')}
            </p>
            {conversation?.booking && (
              <p className="text-xs text-gray-400">
                Job &quot;{conversation.booking.service?.title ?? conversation.booking.booking_number}&quot;
                {conversation.booking.status && <span className="ml-1 capitalize">· {conversation.booking.status.replace(/_/g, ' ')}</span>}
              </p>
            )}
          </div>

          {/* Provider action: send / view offer (Mobile only, hidden on desktop) */}
          {isProvider && (
            <Link
              href={`/messages/${conversationId}/offer/new`}
              className="lg:hidden rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
            >
              + Send Offer
            </Link>
          )}

          {/* Both: view contract if accepted offer exists (Mobile only, hidden on desktop) */}
          {conversation?.booking?.id && (
            <Link
              href={isProvider ? `/provider/bookings/${conversation.booking.id}` : `/bookings/${conversation.booking.id}`}
              className="lg:hidden rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              View Contract
            </Link>
          )}
        </div>

        {/* ── Message thread ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 px-4 py-4">
          {messages.map((msg) => {
            // System event cards — centred, no sender attribution
            if (msg.message_type !== 'text') {
              return (
                <div key={msg.id} className="py-1">
                  <SystemMessageCard msg={msg} conversationId={conversationId} isProvider={isProvider} />
                </div>
              )
            }

            // Regular text bubble
            const mine = msg.sender_id === user?.id
            return (
              <div key={msg.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-xs rounded-2xl px-4 py-2.5 text-sm lg:max-w-md ' +
                    (mine
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100')
                  }
                >
                  {msg.message_text}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-2">
          <SmartReplySuggestions suggestions={suggestions} onSelect={(s) => setText(s)} />
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[360px] flex-col border-l border-gray-100 bg-white overflow-y-auto">
        <JobSidePanel 
          conversation={conversation} 
          offer={offer} 
          isProvider={isProvider} 
          onOfferAction={(action) => {
            setOffer((prev: any) => ({ ...prev, status: action === 'accept' ? 'accepted' : 'declined' }))
          }}
        />
      </div>
    </div>
  )
}
