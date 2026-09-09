'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

/** Turn admin-verified documents into display badges — the actual credential,
 *  never a generic "Documents verified" (design item 25). */
export function credentialBadges(docs: { document_type: string; title?: string | null }[]): string[] {
  const badges: string[] = []
  for (const d of docs) {
    switch (d.document_type) {
      case 'id':        badges.push('ID verified'); break
      case 'insurance': badges.push('Insured'); break
      case 'certification':
      case 'license':   badges.push(d.title?.trim() || 'Certified'); break
      default:          if (d.title?.trim()) badges.push(d.title.trim())
    }
  }
  return Array.from(new Set(badges))
}

/** Verified credential badges for a set of providers, keyed by user_id.
 *  provider_documents is keyed by profile id, so this resolves the mapping
 *  in one round-trip each. */
export function useVerifiedCredentials(userIds: string[]): Record<string, string[]> {
  const [byUser, setByUser] = useState<Record<string, string[]>>({})
  const key = userIds.slice().sort().join(',')

  useEffect(() => {
    if (!key) { setByUser({}); return }
    const ids = key.split(',')
    async function load() {
      const { data: profiles } = await supabase
        .from('provider_profiles')
        .select('id, user_id')
        .in('user_id', ids)
      if (!profiles || profiles.length === 0) { setByUser({}); return }

      const userByProfile: Record<string, string> = {}
      for (const p of profiles) userByProfile[p.id] = p.user_id

      const { data: docs } = await supabase
        .from('provider_documents')
        .select('provider_id, document_type, title')
        .in('provider_id', profiles.map(p => p.id))
        .in('status', ['verified', 'approved'])

      const grouped: Record<string, { document_type: string; title?: string | null }[]> = {}
      for (const d of docs ?? []) {
        const userId = userByProfile[d.provider_id]
        if (!userId) continue
        ;(grouped[userId] ??= []).push(d)
      }
      setByUser(Object.fromEntries(Object.entries(grouped).map(([u, ds]) => [u, credentialBadges(ds)])))
    }
    load()
  }, [key])

  return byUser
}
