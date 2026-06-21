                                                                                                                                                                                             'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useSmartReplies } from '@/hooks/useSmartReplies'
import { SmartReplySuggestions } from '@/components/shared/SmartReplySuggestions'

// ─── System message card ───────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: string; label: (m: string) => string; color: string }> = {
  offer_sent:       { icon: '📋', label: () => 'Sent an offer',          color: 'border-primary/20 bg-primary/[0.06]' },
  offer_updated:    { icon: '✏️',  label: () => 'Updated the offer',      color: 'border-primary/20 bg-primary/[0.06]' },
  offer_accepted:   { icon: '✅', label: () => 'Accepted the offer',     color: 'border-green-200 bg-green-50' },
  offer_declined:   { icon: '❌', label: () => 'Declined the offer',     color: 'border-red-200 bg-red-50' },
  payment_released: { icon: '💸', label: () => 'Released payment',       color: 'border-green-200 bg-green-50' },
  milestone_complete: { icon: '🏁', label: () => 'Marked milestone complete', color: 'border-purple-200 bg-purple-50' },
}

function SystemMessageCard({ msg, conversationId }: { msg: any; conversationId: string }) {
  const meta = EVENT_META[msg.message_type]
  if (!meta) return null

  const md = msg.metadata ?? {}
  const isOfferEvent   = ['offer_sent', 'offer_updated', 'offer_accepted', 'offer_declined'].includes(msg.message_type)
  const isPayment      = msg.message_type === 'payment_released'
  const isMilestone    = msg.message_type === 'milestone_complete'

  const href = isOfferEvent && md.offer_id
    ? `/messages/${conversationId}/offer/${md.offer_id}`
    : md.booking_id && (isPayment || isMilestone)
    ? `/bookings/${md.booking_id}`
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
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeRole = (user as any)?.user_metadata?.active_role as string | undefined
  const isProvider = activeRole === 'provider'

  // ── Load conversation + messages ──────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return

    async function load() {
      const [{ data: conv }, { data: msgs }] = await Promise.all([
        supabase.from('conversations').select('*, booking:bookings(id, booking_number, status, service:services(title))').eq('id', conversationId).single(),
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">

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

        {/* Provider action: send / view offer */}
        {isProvider && (
          <Link
            href={`/messages/${conversationId}/offer/new`}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark"
          >
            + Send Offer
          </Link>
        )}

        {/* Both: view contract if accepted offer exists */}
        {conversation?.booking?.id && (
          <Link
            href={`/bookings/${conversation.booking.id}`}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
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
                <SystemMessageCard msg={msg} conversationId={conversationId} />
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
  )
}
