'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

export function useBookings(filters?: { status?: string }) {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    let q = supabase.from('bookings').select('*').order('created_at', { ascending: false })
    if (filters?.status) q = q.eq('status', filters.status)
    const { data, error } = await q
    if (error) setError(error.message)
    else setBookings(data ?? [])
    setIsLoading(false)
  }, [user?.id, filters?.status])

  useEffect(() => { refetch() }, [refetch])

  return { bookings, isLoading, error, refetch }
}
