'use client'
import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type MessageHandler = (msg: any) => void
interface RealtimeCtx { subscribe: (id: string, handler: MessageHandler) => () => void }

const RealtimeCtx = createContext<RealtimeCtx | null>(null)

export function MessagesRealtimeProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const handlersRef = useRef<Map<string, MessageHandler>>(new Map())

  useEffect(() => {
    if (!user?.id || !session?.access_token) return

    supabase.realtime.setAuth(session.access_token)

    const channel = supabase
      .channel(`user:${user.id}`, { config: { private: true } })
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        handlersRef.current.forEach(fn => fn(payload))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, session?.access_token])

  const subscribe = useCallback((id: string, handler: MessageHandler) => {
    handlersRef.current.set(id, handler)
    return () => { handlersRef.current.delete(id) }
  }, [])

  return <RealtimeCtx.Provider value={{ subscribe }}>{children}</RealtimeCtx.Provider>
}

export function useMessageEvents(onMessage: MessageHandler) {
  const ctx = useContext(RealtimeCtx)
  const ref = useRef(onMessage)
  ref.current = onMessage // always latest without re-registration
  useEffect(() => {
    if (!ctx) return
    const id = Math.random().toString(36).slice(2)
    return ctx.subscribe(id, (msg) => ref.current(msg))
  }, [ctx])
}
