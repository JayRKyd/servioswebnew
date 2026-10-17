'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

export interface CredentialDoc {
  document_type: string
  title?: string | null
  /** The number the admin confirmed against the file (e.g. Gas Safe reg). */
  verified_number?: string | null
}

/** Turn admin-approved documents into display badges — the actual credential
 *  with its registration number, never a generic "Documents verified"
 *  (design item 25; client: "the Gas Safe number and so on"). */
export function credentialBadges(docs: CredentialDoc[]): string[] {
  const badges: string[] = []
  for (const d of docs) {
    const title = d.title?.trim()
    const number = d.verified_number?.trim()
    switch (d.document_type) {
      case 'id':        badges.push('ID verified'); break
      case 'insurance': badges.push('Insured'); break
      case 'certification':
      case 'license': {
        // Avoid "Gas Safe Registered #512394 · 512394" when the title already carries it
        const base = title || 'Certified'
        badges.push(number && !base.includes(number) ? `${base} · ${number}` : base)
        break
      }
      default: if (title) badges.push(title)
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
        .select('provider_id, document_type, title, verified_number')
        .in('provider_id', profiles.map(p => p.id))
        .eq('status', 'approved')

      const grouped: Record<string, CredentialDoc[]> = {}
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
