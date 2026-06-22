'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

const ROLE_COLUMN: Record<string, string> = {
  provider: 'provider_id',
  customer: 'customer_id',
  landlord: 'landlord_id',
  tenant: 'tenant_id',
}

export function useUnreadMessages() {
  const { user, session, activeRole } = useAuth()
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
  const convIdsRef = useRef<Set<string>>(new Set())

  const col = activeRole ? ROLE_COLUMN[activeRole] : undefined

  const compute = useCallback(async () => {
    if (!user || !col) return

    // 1. Conversations the user participates in
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, last_message_at')
      .eq(col, user.id)

    const rows = convs ?? []
    convIdsRef.current = new Set(rows.map((c: any) => c.id))
    const ids = rows.map((c: any) => c.id)
    if (ids.length === 0) {
      setUnreadIds(new Set())
      return
    }

    // 2. This user's read markers
    const { data: reads } = await supabase
      .from('conversation_reads')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)
      .in('conversation_id', ids)
    const readMap: Record<string, string> = {}
    reads?.forEach((r: any) => { readMap[r.conversation_id] = r.last_read_at })

    // 3. Conversations whose latest activity is newer than the read marker
    const candidates = rows.filter((c: any) => {
      if (!c.last_message_at) return false
      const read = readMap[c.id]
      return !read || new Date(c.last_message_at).getTime() > new Date(read).getTime()
    })
    if (candidates.length === 0) {
      setUnreadIds(new Set())
      return
    }

    // 4. Of those, keep only conversations whose latest message is NOT mine
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, sender_id, created_at')
      .in('conversation_id', candidates.map((c: any) => c.id))
      .order('created_at', { ascending: false })

    const latestSender: Record<string, string> = {}
    msgs?.forEach((m: any) => {
      if (!latestSender[m.conversation_id]) latestSender[m.conversation_id] = m.sender_id
    })

    const next = new Set<string>()
    candidates.forEach((c: any) => {
      if (latestSender[c.id] && latestSender[c.id] !== user.id) next.add(c.id)
    })
    setUnreadIds(next)
  }, [user?.id, col])

  useEffect(() => { compute() }, [compute])

  // Realtime: keep the unread set live
  useEffect(() => {
    if (!user?.id || !session?.access_token) return

    supabase.realtime.setAuth(session.access_token)

    const channel = supabase
      .channel(`unread:${user.id}`)
      // New messages → mark their conversation unread (RLS only delivers my convs)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const msg = payload.new as any
          if (msg.message_type !== 'text') return
          if (msg.sender_id === user.id) return
          if (convIdsRef.current.size > 0 && !convIdsRef.current.has(msg.conversation_id)) return
          setUnreadIds((prev: Set<string>) => {
            if (prev.has(msg.conversation_id)) return prev
            const next = new Set(prev)
            next.add(msg.conversation_id)
            return next
          })
        },
      )
      // Read markers (this user) → clear unread, syncs across devices/tabs
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const row = (payload.new ?? payload.old) as any
          if (!row?.conversation_id) return
          setUnreadIds((prev: Set<string>) => {
            if (!prev.has(row.conversation_id)) return prev
            const next = new Set(prev)
            next.delete(row.conversation_id)
            return next
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, session?.access_token])

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!user) return
    setUnreadIds((prev: Set<string>) => {
      if (!prev.has(conversationId)) return prev
      const next = new Set(prev)
      next.delete(conversationId)
      return next
    })
    await supabase
      .from('conversation_reads')
      .upsert(
        { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' },
      )
  }, [user?.id])

  return { unreadCount: unreadIds.size, unreadIds, markConversationRead, refetch: compute }
}
