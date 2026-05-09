'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export interface ProfileIds {
  customerId:  string | null
  providerId:  string | null
  landlordId:  string | null
  tenantId:    string | null
  loading:     boolean
}

type IdsOnly = Omit<ProfileIds, 'loading'>

// Module-level cache — survives page-to-page navigation within the same session.
// Cleared on logout (user → null). Never needs to be invalidated otherwise
// because profile IDs are stable for the lifetime of a session.
let _cache: { userId: string; ids: IdsOnly } | null = null

const EMPTY: IdsOnly = { customerId: null, providerId: null, landlordId: null, tenantId: null }

export function useProfileIds(): ProfileIds {
  const { user } = useAuth()

  const hasCacheHit = !!(user && _cache?.userId === user.id)

  const [ids, setIds] = useState<IdsOnly>(() =>
    hasCacheHit ? _cache!.ids : EMPTY
  )
  const [loading, setLoading] = useState(!hasCacheHit)

  useEffect(() => {
    if (!user) {
      _cache = null   // clear on logout
      setLoading(false)
      return
    }

    // Cache hit — update state synchronously (React bails out if refs are equal)
    if (_cache?.userId === user.id) {
      setIds(_cache.ids)
      setLoading(false)
      return
    }

    // Cache miss — fetch all profile IDs in parallel (one round-trip per role table)
    setLoading(true)
    Promise.all([
      supabase.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('landlord_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('tenant_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    ])
      .then(([c, p, l, t]) => {
        const newIds: IdsOnly = {
          customerId: c.data?.id ?? null,
          providerId: p.data?.id ?? null,
          landlordId: l.data?.id ?? null,
          tenantId:   t.data?.id ?? null,
        }
        _cache = { userId: user.id, ids: newIds }
        setIds(newIds)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user?.id])

  return { ...ids, loading }
}
