'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function TenantChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id).limit(1).single()
      .then(async ({ data }) => {
        const cid = data?.conversation_id
        setConversationId(cid ?? null)
        if (cid) {
          const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: true })
          setMessages(msgs ?? [])
        }
        setLoading(false)
      })
  }, [user?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user || !conversationId) return
    const content = text
    setText('')
    const { data } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: user.id, message_text: content, message_type: 'text' }).select().single()
    if (data) setMessages(m => [...m, data])
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <h1 className="mb-4 text-xl font-bold text-gray-900">Chat with Landlord</h1>
      {loading ? <div className="flex flex-1 items-center justify-center text-gray-400">Loading…</div> :
        !conversationId ? (
          <div className="flex flex-1 items-center justify-center text-gray-400">No active conversation</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 rounded-xl bg-gray-50 p-4">
              {messages.map(msg => {
                const mine = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
                    <div className={'max-w-xs rounded-2xl px-4 py-2 text-sm ' + (mine ? 'bg-primary text-white' : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-100')}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="mt-3 flex gap-2">
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…"
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">Send</button>
            </form>
          </>
        )
      }
    </div>
  )
}
