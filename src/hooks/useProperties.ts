'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from './useAuth'

export function useProperties() {
  const { user } = useAuth()
  const [properties, setProperties] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setProperties(data ?? [])
    setIsLoading(false)
  }, [user?.id])

  useEffect(() => { refetch() }, [refetch])

  return { properties, isLoading, error, refetch }
}
