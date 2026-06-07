'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useSmartReplies } from '@/hooks/useSmartReplies'
import { SmartReplySuggestions } from '@/components/shared/SmartReplySuggestions'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── System message card ───────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: string; label: () => string; color: string }> = {
  offer_sent:         { icon: '📋', label: () => 'Sent an offer',               color: 'border-primary/20 bg-primary/[0.06]' },
  offer_updated:      { icon: '✏️',  label: () => 'Updated the offer',           color: 'border-primary/20 bg-primary/[0.06]' },
  offer_accepted:     { icon: '✅', label: () => 'Accepted the offer',          color: 'border-green-200 bg-green-50' },
  offer_declined:     { icon: '❌', label: () => 'Declined the offer',          color: 'border-red-200 bg-red-50' },
  payment_released:   { icon: '💸', label: () => 'Released payment',            color: 'border-green-200 bg-green-50' },
  milestone_complete: { icon: '🏁', label: () => 'Marked milestone complete',   color: 'border-purple-200 bg-purple-50' },
}

function SystemMessageCard({ msg, conversationId }: { msg: any; conversationId: string }) {
  const meta = EVENT_META[msg.message_type]
  if (!meta) return null

  const md = msg.metadata ?? {}
  const isOfferEvent = ['offer_sent', 'offer_updated', 'offer_accepted', 'offer_declined'].includes(msg.message_type)
  const isPayment    = msg.message_type === 'payment_released'
  const isMilestone  = msg.message_type === 'milestone_complete'

  const href = isOfferEvent && md.offer_id
    ? `/messages/${conversationId}/offer/${md.offer_id}`
    : md.booking_id && (isPayment || isMilestone)
    ? `/bookings/${md.booking_id}`
    : null

  return (
    <div className={`mx-auto max-w-sm rounded-xl border px-4 py-3 text-center ${meta.color}`}>
      <p className="text-sm font-semibold text-gray-800">
        {meta.icon} {md.title ? `"${md.title}"` : meta.label()}
      </p>
      {(md.total_cents || md.amount_cents) && (
        <p className="mt-0.5 text-xs text-gray-500">
          £{((md.total_cents ?? md.amount_cents) / 100).toFixed(2)}
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

// ─── Job details side panel ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-yellow-100 text-yellow-700',
  accepted:     'bg-blue-100 text-primary',
  in_progress:  'bg-purple-100 text-purple-700',
  completed:    'bg-green-100 text-green-700',
  cancelled:    'bg-gray-100 text-gray-500',
  rejected:     'bg-red-100 text-red-700',
}

function JobDetailsPanel({
  booking,
  conversationId,
  isProvider,
}: {
  booking: any
  conversationId: string
  isProvider: boolean
}) {
  if (!booking) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-gray-400">No job linked to this conversation.</p>
      </div>
    )
  }

  const gross      = booking.base_amount ?? booking.total_amount ?? 0
  const fee        = booking.platform_fee ?? 0
  const net        = gross - fee
  const milestones = [...(booking.milestones ?? [])].sort((a: any, b: any) => a.milestone_number - b.milestone_number)

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-5">
      {/* Title + status */}
      <div>
        <p className="font-semibold text-gray-900 leading-snug">
          {booking.service?.title ?? `Job #${booking.booking_number}`}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">#{booking.booking_number}</p>
        {booking.status && (
          <span className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {booking.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Financials */}
      {gross > 0 && (
        <div className="rounded-xl bg-gray-50 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Financials</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross</span>
              <span className="font-medium text-gray-900">{formatCurrency(gross / 100)}</span>
            </div>
            {fee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Platform fee</span>
                <span className="font-medium text-red-500">−{formatCurrency(fee / 100)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1.5">
              <span className="font-semibold text-gray-700">{isProvider ? 'You receive' : 'Total'}</span>
              <span className="font-bold text-green-700">{formatCurrency(net / 100)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled date */}
      {booking.scheduled_date && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Scheduled</p>
          <p className="text-sm text-gray-700">{formatDate(booking.scheduled_date)}
            {booking.scheduled_time_start && <span className="text-gray-400"> · {booking.scheduled_time_start}</span>}
          </p>
        </div>
      )}

      {/* Milestone timeline */}
      {milestones.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Milestones</p>
          <ol className="relative border-l border-gray-200 space-y-4 ml-2">
            {milestones.map((m: any) => {
              const released  = m.status === 'released'
              const active    = m.status === 'active'
              return (
                <li key={m.id} className="ml-4">
                  {/* timeline dot */}
                  <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${
                    released ? 'bg-green-500' : active ? 'bg-primary' : 'bg-gray-300'
                  }`}>
                    {released && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10">
                        <path d="M1.5 5l2.5 2.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${released ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {m.milestone_number}. {m.title}
                      </p>
                      {m.due_date && (
                        <p className="text-xs text-gray-400 mt-0.5">Due {m.due_date}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-700">£{Number(m.amount).toFixed(2)}</p>
                      <span className={`text-[11px] font-medium capitalize ${
                        released ? 'text-green-600' : active ? 'text-primary' : 'text-gray-400'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto space-y-2 pt-2">
        {booking.id && (
          <Link
            href={isProvider ? `/provider/bookings/${booking.id}` : `/bookings/${booking.id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Contract →
          </Link>
        )}
        {isProvider && (
          <Link
            href={`/messages/${conversationId}/offer/new`}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            + Send Offer
          </Link>
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

  const [messages, setMessages]         = useState<any[]>([])
  const [text, setText]                 = useState('')
  const [loading, setLoading]           = useState(true)
  const [sending, setSending]           = useState(false)
  const [conversation, setConversation] = useState<any>(null)
  const [otherParty, setOtherParty]     = useState<{ name: string } | null>(null)
  const [panelOpen, setPanelOpen]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeRole = (user as any)?.user_metadata?.active_role as string | undefined
  const isProvider = activeRole === 'provider'

  // ── Load conversation + messages ──────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return

    async function load() {
      const [{ data: conv }, { data: msgs }] = await Promise.all([
        supabase.from('conversations').select(`
          *,
          booking:bookings(
            id, booking_number, status, scheduled_date, scheduled_time_start,
            base_amount, total_amount, platform_fee,
            service:services(title),
            milestones:booking_milestones(id, title, amount, status, milestone_number, due_date)
          )
        `).eq('id', conversationId).single(),
        supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true }),
      ])
      setConversation(conv)
      setMessages(msgs ?? [])

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

  const booking = conversation?.booking ?? null

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row overflow-hidden">

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT COLUMN — header + message thread + input
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-gray-100">

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shrink-0">
          <button onClick={() => router.back()} className="shrink-0 text-sm text-primary hover:underline">
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {otherParty?.name ?? (isProvider ? 'Customer' : 'Provider')}
            </p>
            {booking && (
              <p className="text-xs text-gray-400 truncate">
                {booking.service?.title ?? `Job #${booking.booking_number}`}
                {booking.status && (
                  <span className="ml-1 capitalize">· {booking.status.replace(/_/g, ' ')}</span>
                )}
              </p>
            )}
          </div>

          {/* Mobile: Details toggle */}
          {booking && (
            <button
              onClick={() => setPanelOpen(o => !o)}
              className="md:hidden shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              {panelOpen ? 'Hide details' : 'Details'}
            </button>
          )}
        </div>

        {/* Mobile: details panel (shown inline below header when toggled) */}
        {panelOpen && booking && (
          <div className="md:hidden border-b border-gray-100 bg-white max-h-72 overflow-y-auto">
            <JobDetailsPanel booking={booking} conversationId={conversationId} isProvider={isProvider} />
          </div>
        )}

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto space-y-3 bg-gray-50 px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map((msg) => {
            if (msg.message_type !== 'text') {
              return (
                <div key={msg.id} className="py-1">
                  <SystemMessageCard msg={msg} conversationId={conversationId} />
                </div>
              )
            }
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

        {/* Input */}
        <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 space-y-2">
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
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT COLUMN — persistent job details panel (desktop only)
      ═══════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex md:w-72 md:flex-col md:overflow-hidden md:bg-white md:border-l md:border-gray-100 lg:w-80">
        {booking ? (
          <>
            <div className="shrink-0 border-b border-gray-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Job Details</p>
            </div>
            <JobDetailsPanel booking={booking} conversationId={conversationId} isProvider={isProvider} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-center text-sm text-gray-400">No job linked to this conversation.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
