'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export type ProviderAvailability = { today: boolean; week: boolean }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Live availability signals for a set of providers, computed from their
 *  weekly schedule + blocked dates. `today` = works today (and today isn't
 *  blocked); `week` = works at least one of the next 7 days. Providers with
 *  no availability row are absent from the map (treated as unknown). */
export function useProviderAvailability(userIds: string[]): Record<string, ProviderAvailability> {
  const [map, setMap] = useState<Record<string, ProviderAvailability>>({})
  const key = userIds.slice().sort().join(',')

  useEffect(() => {
    if (userIds.length === 0) { setMap({}); return }
    let active = true
    supabase
      .from('provider_availability')
      .select('provider_id, blocked_dates, monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled, friday_enabled, saturday_enabled, sunday_enabled')
      .in('provider_id', userIds)
      .then(({ data }) => {
        if (!active) return
        const next: Record<string, ProviderAvailability> = {}
        const now = new Date()
        for (const row of (data ?? []) as any[]) {
          const blocked: string[] = row.blocked_dates ?? []
          const worksOn = (d: Date) =>
            !!row[`${DAY_KEYS[d.getDay()]}_enabled`] && !blocked.includes(toDateStr(d))

          let week = false
          for (let i = 0; i < 7 && !week; i++) {
            const d = new Date(now)
            d.setDate(now.getDate() + i)
            week = worksOn(d)
          }
          next[row.provider_id] = { today: worksOn(now), week }
        }
        setMap(next)
      })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return map
}
