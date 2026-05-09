'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

export function useMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('*, conversation_participants!inner(user_id), messages(content, created_at)')
      .eq('conversation_participants.user_id', user.id)
      .order('updated_at', { ascending: false })
    setConversations(data ?? [])
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => { refetch() }, [refetch])

  return { conversations, isLoading, refetch }
}
