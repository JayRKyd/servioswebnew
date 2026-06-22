'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

export function useNotifications() {
  const { user, session } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

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
      .channel(`notifications:${user.id}`)
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
