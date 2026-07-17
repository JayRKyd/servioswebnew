'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

let instanceCounter = 0

export function useNotifications() {
  const { user, session } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  // Channel topics must be unique per client: this hook mounts more than once
  // (Sidebar badge + /notifications page), and supabase-js returns the existing
  // channel for a duplicate topic — adding callbacks to an already-subscribed
  // channel throws and crashes the page.
  const instanceIdRef = useRef(++instanceCounter)

  const refetch = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setUnreadCount((data ?? []).filter((n: any) => !n.is_read).length)
    setIsLoading(false)
  }, [user?.id])

  const markAllRead = useCallback(async () => {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    refetch()
  }, [user?.id, refetch])

  useEffect(() => { refetch() }, [refetch])

  // Real-time: keep notifications + badge live
  useEffect(() => {
    if (!user?.id || !session?.access_token) return

    supabase.realtime.setAuth(session.access_token)

    const channel = supabase
      .channel(`notifications:${user.id}:${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { refetch() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, session?.access_token, refetch])

  return { notifications, unreadCount, isLoading, refetch, markAllRead }
}
