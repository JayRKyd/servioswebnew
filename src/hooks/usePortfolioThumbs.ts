'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

/**
 * Batch-fetches the first portfolio photo for a set of providers so listing
 * cards can show real work photos instead of empty initial-letter tiles.
 * Returns a map of user_id → photo URL (providers without photos are absent).
 */
export function usePortfolioThumbs(userIds: string[]): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const key = userIds.slice().sort().join(',')

  useEffect(() => {
    if (userIds.length === 0) { setThumbs({}); return }
    let active = true
    supabase
      .from('provider_portfolio_photos')
      .select('url, sort_order, provider:provider_profiles!inner(user_id)')
      .in('provider.user_id', userIds)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        const map: Record<string, string> = {}
        for (const row of (data ?? []) as any[]) {
          const uid = row.provider?.user_id
          if (uid && !map[uid]) map[uid] = row.url
        }
        setThumbs(map)
      })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return thumbs
}
