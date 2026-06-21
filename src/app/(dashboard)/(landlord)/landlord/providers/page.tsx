'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type Tab = 'preferred' | 'invitations'

interface PreferredProvider {
  id: string
  notes: string | null
  created_at: string
  provider: {
    user_id: string
    display_name: string
    avatar_url: string | null
    bio: string | null
    categories: string[]
    rating_average: number | null
    hourly_rate: number | null
    island: string | null
    is_verified: boolean
  }
}

interface SearchResult {
  user_id: string
  display_name: string
  categories: string[]
  rating_average: number | null
  hourly_rate: number | null
  island: string | null
  is_verified: boolean
}

export default function PreferredProvidersPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('preferred')
  const [preferred, setPreferred] = useState<PreferredProvider[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Add-provider search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Notes modal
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPreferred = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: landlord } = await supabase.from('landlord_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!landlord) { setLoading(false); return }
    const { data } = await supabase
      .from('preferred_providers')
      .select('id, notes, created_at, provider:provider_profiles(user_id, business_name, first_name, last_name, bio, trade_category, rating_average, hourly_rate, service_areas, verification_status)')
      .eq('landlord_id', landlord.id)
      .order('created_at', { ascending: false })
    setPreferred((data ?? []).map((row: any) => ({
      ...row,
      provider: {
        ...row.provider,
        display_name: row.provider?.business_name ?? `${row.provider?.first_name ?? ''} ${row.provider?.last_name ?? ''}`.trim(),
        is_verified: row.provider?.verification_status === 'verified',
        categories: row.provider?.trade_category ? [row.provider.trade_category] : [],
        island: row.provider?.service_areas?.[0] ?? null,
      }
    })))
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    fetchPreferred()
    supabase
      .from('invitations')
      .select('*')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInvitations(data ?? []))
  }, [user?.id, fetchPreferred])

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('provider_profiles')
      .select('user_id, business_name, first_name, last_name, trade_category, rating_average, hourly_rate, service_areas, verification_status')
      .or(`business_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .eq('verification_status', 'verified')
      .limit(10)
    setSearchResults((data ?? []).map((p: any) => ({
      user_id: p.user_id,
      display_name: p.business_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      categories: p.trade_category ? [p.trade_category] : [],
      rating_average: p.rating_average,
      hourly_rate: p.hourly_rate,
      island: p.service_areas?.[0] ?? null,
      is_verified: true,
    })))
    setSearching(false)
  }

  async function addProvider(providerUserId: string) {
    if (!user) return
    const { data: landlord } = await supabase.from('landlord_profiles').select('id').eq('user_id', user.id).maybeSingle()
    const { data: provider } = await supabase.from('provider_profiles').select('id').eq('user_id', providerUserId).maybeSingle()
    if (!landlord || !provider) return
    await supabase.from('preferred_providers').upsert({ landlord_id: landlord.id, provider_id: provider.id }, { onConflict: 'landlord_id,provider_id' })
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    fetchPreferred()
  }

  async function removeProvider(providerUserId: string) {
    if (!confirm('Remove this provider from your preferred list?')) return
    const entry = preferred.find((p) => p.provider.user_id === providerUserId)
    if (entry) await supabase.from('preferred_providers').delete().eq('id', entry.id)
    setPreferred((prev) => prev.filter((p) => p.provider.user_id !== providerUserId))
  }

  async function saveNotes() {
    if (!editingId) return
    setSaving(true)
    const entry = preferred.find((p) => p.provider.user_id === editingId)
    if (entry) await supabase.from('preferred_providers').update({ notes: notesValue || null }).eq('id', entry.id)
    setPreferred((prev) =>
      prev.map((p) => (p.provider.user_id === editingId ? { ...p, notes: notesValue || null } : p))
    )
    setEditingId(null)
    setSaving(false)
  }

  const preferredIds = new Set(preferred.map((p) => p.provider.user_id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            + Add Preferred
          </button>
          <Link href="/landlord/providers/invite" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Invite Provider
          </Link>
        </div>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <p className="text-sm font-medium text-gray-700">Search verified providers</p>
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Provider name…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          {searching && <p className="text-xs text-gray-400">Searching…</p>}
          {searchResults.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
              {searchResults.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.display_name}</p>
                    <p className="text-xs text-gray-400">
                      {r.island} · {r.categories?.slice(0, 2).join(', ')}
                      {r.rating_average ? ` · ★ ${r.rating_average.toFixed(1)}` : ''}
                    </p>
                  </div>
                  {preferredIds.has(r.user_id) ? (
                    <span className="text-xs text-green-600 font-medium">Added</span>
                  ) : (
                    <button
                      onClick={() => addProvider(r.user_id)}
                      className="rounded-md bg-primary/[0.06] px-3 py-1 text-xs font-medium text-primary hover:bg-blue-100"
                    >
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400">No verified providers found for &quot;{searchQuery}&quot;</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {(['preferred', 'invitations'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ' +
              (tab === t ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50')
            }
          >
            {t === 'preferred' ? `Preferred (${preferred.length})` : `Invitations (${invitations.length})`}
          </button>
        ))}
      </div>

      {/* Preferred tab */}
      {tab === 'preferred' && (
        <>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
          ) : preferred.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <p className="text-gray-400">No preferred providers yet</p>
                <button onClick={() => setShowSearch(true)} className="mt-2 text-sm text-primary hover:underline">
                  Add your first provider
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {preferred.map((pp) => {
                const p = pp.provider
                const initials = p.display_name?.slice(0, 2).toUpperCase() ?? '??'
                return (
                  <div key={pp.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-primary">
                        {initials}
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{p.display_name}</p>
                          {p.is_verified && <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">✓ Verified</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {p.categories?.slice(0, 3).map((cat) => (
                            <span key={cat} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{cat}</span>
                          ))}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                          {p.island && <span>{p.island}</span>}
                          {p.rating_average && <span>★ {p.rating_average.toFixed(1)}</span>}
                          {p.hourly_rate && <span>£{p.hourly_rate}/hr</span>}
                        </div>
                        {/* Notes */}
                        {editingId === p.user_id ? (
                          <div className="mt-2 flex items-start gap-2">
                            <textarea
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              placeholder="Private notes…"
                              rows={2}
                              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            />
                            <div className="flex flex-col gap-1">
                              <button onClick={saveNotes} disabled={saving} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingId(null)} className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(p.user_id); setNotesValue(pp.notes ?? '') }}
                            className="mt-1.5 text-xs text-gray-400 hover:text-primary"
                          >
                            {pp.notes ? `📝 ${pp.notes}` : '+ Add private note'}
                          </button>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex shrink-0 flex-col gap-2">
                        <Link
                          href={`/landlord/providers/${p.user_id}`}
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => removeProvider(p.user_id)}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Invitations tab */}
      {tab === 'invitations' && (
        <>
          {invitations.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <p className="text-gray-400">No invitations sent yet</p>
                <Link href="/landlord/providers/invite" className="mt-2 block text-sm text-primary hover:underline">
                  Invite a provider
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">{inv.email}</p>
                    {inv.message && <p className="text-xs text-gray-400 mt-0.5">{inv.message.slice(0, 80)}</p>}
                    <p className="text-xs text-gray-300 mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (inv.status === 'accepted' ? 'bg-green-100 text-green-700' : inv.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
