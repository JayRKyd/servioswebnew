'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, titleCase } from '@/lib/utils'

export default function MessagesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [customerUserId, setCustomerUserId] = useState<string | null>(null)

  // New message search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const role = user?.user_metadata?.active_role

  useEffect(() => {
    if (!user) return

    async function load() {
      if (role === 'provider') {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, last_message_at, conversation_type, customer_id, booking:bookings(booking_number)')
          .eq('provider_id', user!.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
        const rows = convs ?? []
        // Resolve customer names
        const customerIds = Array.from(new Set(rows.map((c: any) => c.customer_id).filter(Boolean)))
        let nameMap: Record<string, string> = {}
        if (customerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('customer_profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', customerIds)
          profiles?.forEach((p: any) => { nameMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim() || 'Customer' })
        }
        await attachLastMessages(rows.map((c: any) => ({ ...c, resolvedName: nameMap[c.customer_id] ?? 'Customer' })))
      } else if (role === 'customer') {
        setCustomerUserId(user!.id)
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, last_message_at, conversation_type, provider_id, booking:bookings(booking_number)')
          .eq('customer_id', user!.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
        const rows = convs ?? []
        // Resolve provider names
        const providerIds = Array.from(new Set(rows.map((c: any) => c.provider_id).filter(Boolean)))
        let nameMap: Record<string, string> = {}
        if (providerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('provider_profiles')
            .select('user_id, first_name, last_name, business_name')
            .in('user_id', providerIds)
          profiles?.forEach((p: any) => { nameMap[p.user_id] = p.business_name || `${p.first_name} ${p.last_name}`.trim() || 'Provider' })
        }
        await attachLastMessages(rows.map((c: any) => ({ ...c, resolvedName: nameMap[c.provider_id] ?? 'Provider' })))
      } else {
        setLoading(false)
      }
    }

    async function attachLastMessages(convs: any[]) {
      const ids = convs.map((c: any) => c.id)
      let lastMsgs: Record<string, string> = {}
      if (ids.length > 0) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('conversation_id, content, message_type')
          .in('conversation_id', ids)
          .eq('message_type', 'text')
          .order('created_at', { ascending: false })
        msgs?.forEach((m: any) => { if (!lastMsgs[m.conversation_id]) lastMsgs[m.conversation_id] = m.content })
      }
      setConversations(convs.map((c: any) => ({ ...c, lastMsg: lastMsgs[c.id] ?? null })))
      setLoading(false)
    }

    load()
  }, [user?.id])

  // Search providers as customer types
  useEffect(() => {
    if (!showSearch) return
    clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('provider_profiles')
        .select('id, user_id, business_name, first_name, last_name, trade_category, profile_image_url')
        .or(`business_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,trade_category.ilike.%${searchQuery}%`)
        .eq('verification_status', 'verified')
        .limit(8)
      setSearchResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery, showSearch])

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }
    if (showSearch) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSearch])

  async function startConversation(provider: any) {
    if (!customerUserId || starting) return
    setStarting(true)
    setStartError(null)
    try {
      // Find existing conversation
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', customerUserId)
        .eq('provider_id', provider.user_id)
        .maybeSingle()

      if (existing?.id) {
        router.push('/messages/' + existing.id)
        return
      }

      // Create new
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ customer_id: customerUserId, provider_id: provider.user_id, conversation_type: 'direct' })
        .select('id')
        .single()

      if (error) {
        console.error('create conversation error:', error)
        setStartError(error.message)
        return
      }
      if (!conv) { setStartError('Failed to create conversation'); return }
      router.push('/messages/' + conv.id)
    } catch (e: any) {
      console.error('startConversation unexpected error:', e)
      setStartError(e?.message ?? String(e))
    } finally {
      setStarting(false)
    }
  }

  function displayName(c: any) {
    const raw = c.resolvedName ?? (role === 'provider' ? 'Customer' : 'Provider')
    return raw.split(' ').map((w: string) => titleCase(w)).join(' ')
  }

  return (
    <div className="space-y-6">
      {startError && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {startError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        {role === 'customer' && (
          <div ref={searchRef} className="relative">
            {showSearch ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 w-72">
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    autoFocus
                    placeholder="Search providers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                  {searching && <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500 shrink-0" />}
                </div>

                {(searchResults.length > 0 || (searchQuery && !searching)) && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-gray-100">
                    {searchResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No providers found</p>
                    ) : (
                      searchResults.map(p => (
                        <button
                          key={p.id}
                          onClick={() => startConversation(p)}
                          disabled={starting}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-primary">
                            {(p.business_name ?? p.first_name)?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {p.business_name || `${p.first_name} ${p.last_name}`.trim()}
                            </p>
                            {p.trade_category && <p className="truncate text-xs text-gray-400">{p.trade_category}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New message
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : conversations.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <div className="text-center">
            <p className="text-gray-400">No conversations yet</p>
            {role === 'customer' && (
              <button onClick={() => setShowSearch(true)} className="mt-2 text-sm text-primary hover:underline">
                Message a provider
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(c => {
            const name = displayName(c)
            const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
            const isRecent = c.last_message_at && (Date.now() - new Date(c.last_message_at).getTime()) < 86400000
            return (
              <Link key={c.id} href={'/messages/' + c.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{name}</p>
                    {c.booking?.booking_number && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">#{c.booking.booking_number}</span>
                    )}
                    {isRecent && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  {c.lastMsg && <p className="text-sm text-gray-500 truncate">{c.lastMsg}</p>}
                </div>
                <p className="ml-auto text-xs text-gray-400 whitespace-nowrap shrink-0">{c.last_message_at ? formatDate(c.last_message_at) : ''}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
