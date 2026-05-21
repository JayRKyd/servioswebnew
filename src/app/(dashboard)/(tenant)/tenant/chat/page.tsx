'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function TenantChatPage() {
  const { user } = useAuth()
  const [messages, setMessages]       = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [text, setText]               = useState('')
  const [loading, setLoading]         = useState(true)
  const [starting, setStarting]       = useState(false)
  const bottomRef                     = useRef<HTMLDivElement>(null)

  // ── Load or initialise conversation ──────────────────────────────────────
  useEffect(() => {
    if (!user) return

    async function load() {
      const { data: part } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle()

      const cid = part?.conversation_id ?? null
      setConversationId(cid)

      if (cid) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', cid)
          .order('created_at', { ascending: true })
        setMessages(msgs ?? [])
      }
      setLoading(false)
    }

    load()
  }, [user?.id])

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`tenant-chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages(prev => [...prev, payload.new]),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Start a new conversation with the landlord ────────────────────────────
  async function startConversation() {
    if (!user) return
    setStarting(true)

    // Find the tenant's active tenancy to get the landlord's profile ID
    const { data: tenancy } = await supabase
      .from('tenants')
      .select('landlord_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!tenancy?.landlord_id) {
      setStarting(false)
      return
    }

    // Resolve landlord's auth user_id from their profile
    const { data: landlordProfile } = await supabase
      .from('landlord_profiles')
      .select('user_id')
      .eq('id', tenancy.landlord_id)
      .maybeSingle()

    if (!landlordProfile?.user_id) {
      setStarting(false)
      return
    }

    // Create conversation row
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ customer_id: user.id, provider_id: landlordProfile.user_id })
      .select('id')
      .single()

    if (!conv?.id) { setStarting(false); return }

    // Add both participants
    await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: landlordProfile.user_id },
    ])

    setConversationId(conv.id)
    setStarting(false)
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || !conversationId) return
    const content = text
    setText('')
    const { data } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_text: content,
        message_type: 'text',
      })
      .select()
      .single()
    if (data) setMessages(m => [...m, data])
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
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
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <h1 className="mb-4 text-xl font-bold text-gray-900 shrink-0">Chat with Landlord</h1>

      {!conversationId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-gray-400 text-sm">No conversation yet.</p>
          <button
            onClick={startConversation}
            disabled={starting}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Message your landlord'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 rounded-xl bg-gray-50 p-4">
            {messages.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">No messages yet. Say hello!</p>
            )}
            {messages.map(msg => {
              const mine = msg.sender_id === user?.id
              return (
                <div key={msg.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                  <div className={'max-w-xs rounded-2xl px-4 py-2.5 text-sm lg:max-w-md ' + (mine ? 'bg-primary text-white' : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100')}>
                    {msg.message_text}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="mt-3 flex shrink-0 gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  )
}
