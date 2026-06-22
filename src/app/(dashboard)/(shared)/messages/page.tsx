'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { titleCase } from '@/lib/utils'
import { Search, Plus, MessageSquare, X } from 'lucide-react'

// ── Time formatting ────────────────────────────────────────────────────────────
function formatConversationTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek  = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())

  if (d >= startOfToday)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (d >= startOfWeek)
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Name normalisation ─────────────────────────────────────────────────────────
function normaliseName(raw: string): string {
  return raw.split(' ').map(w => titleCase(w)).join(' ')
}

// ── Initials ──────────────────────────────────────────────────────────────────
function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

// ── Avatar colours (deterministic per name) ───────────────────────────────────
const AVATAR_COLOURS = [
  'bg-primary/20 text-primary',
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-teal-100 text-teal-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
]
function avatarColour(name: string): string {
  let n = 0
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i)
  return AVATAR_COLOURS[n % AVATAR_COLOURS.length]
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [customerUserId, setCustomerUserId] = useState<string | null>(null)

  // Conversation filter
  const [filterQuery, setFilterQuery] = useState('')

  // New-message search (customers only)
  const [showSearch,    setShowSearch]    = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching,     setSearching]     = useState(false)
  const [starting,      setStarting]      = useState(false)
  const [startError,    setStartError]    = useState<string | null>(null)
  const searchRef  = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const role = user?.user_metadata?.active_role

  // ── Load conversations ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    async function load() {
      if (role === 'provider') {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, last_message_at, conversation_type, customer_id, booking:bookings(booking_number, service:services(title))')
          .eq('provider_id', user!.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })

        const rows = convs ?? []
        const customerIds = Array.from(new Set(rows.map((c: any) => c.customer_id).filter(Boolean)))
        let nameMap: Record<string, { name: string; avatar: string | null }> = {}
        if (customerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('customer_profiles')
            .select('user_id, first_name, last_name, profile_image_url')
            .in('user_id', customerIds)
          profiles?.forEach((p: any) => {
            nameMap[p.user_id] = {
              name: `${p.first_name} ${p.last_name}`.trim() || 'Customer',
              avatar: p.profile_image_url ?? null,
            }
          })
        }
        await attachLastMessages(rows.map((c: any) => ({
          ...c,
          resolvedName: nameMap[c.customer_id]?.name ?? 'Customer',
          resolvedAvatar: nameMap[c.customer_id]?.avatar ?? null,
        })))
      } else if (role === 'customer') {
        setCustomerUserId(user!.id)
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, last_message_at, conversation_type, provider_id, booking:bookings(booking_number, service:services(title))')
          .eq('customer_id', user!.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })

        const rows = convs ?? []
        const providerIds = Array.from(new Set(rows.map((c: any) => c.provider_id).filter(Boolean)))
        let nameMap: Record<string, { name: string; avatar: string | null }> = {}
        if (providerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('provider_profiles')
            .select('user_id, business_name, first_name, last_name, profile_image_url')
            .in('user_id', providerIds)
          profiles?.forEach((p: any) => {
            nameMap[p.user_id] = {
              name: p.business_name || `${p.first_name} ${p.last_name}`.trim() || 'Provider',
              avatar: p.profile_image_url ?? null,
            }
          })
        }
        await attachLastMessages(rows.map((c: any) => ({
          ...c,
          resolvedName: nameMap[c.provider_id]?.name ?? 'Provider',
          resolvedAvatar: nameMap[c.provider_id]?.avatar ?? null,
        })))
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
          .select('conversation_id, message_text, message_type')
          .in('conversation_id', ids)
          .eq('message_type', 'text')
          .order('created_at', { ascending: false })
        msgs?.forEach((m: any) => {
          if (!lastMsgs[m.conversation_id]) lastMsgs[m.conversation_id] = m.message_text
        })
      }
      setConversations(convs.map((c: any) => ({ ...c, lastMsg: lastMsgs[c.id] ?? null })))
      setLoading(false)
    }

    load()
  }, [user?.id])

  // ── Provider search (new message) ────────────────────────────────────────
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

  // Close new-message panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false); setSearchQuery(''); setSearchResults([])
      }
    }
    if (showSearch) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSearch])

  async function startConversation(provider: any) {
    if (!customerUserId || starting) return
    setStarting(true); setStartError(null)
    try {
      const { data: existing } = await supabase
        .from('conversations').select('id')
        .eq('customer_id', customerUserId).eq('provider_id', provider.user_id).maybeSingle()
      if (existing?.id) { router.push('/messages/' + existing.id); return }
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ customer_id: customerUserId, provider_id: provider.user_id, conversation_type: 'direct' })
        .select('id').single()
      if (error) { setStartError(error.message); return }
      if (!conv) { setStartError('Failed to create conversation'); return }
      router.push('/messages/' + conv.id)
    } catch (e: any) {
      setStartError(e?.message ?? String(e))
    } finally {
      setStarting(false)
    }
  }

  // ── Filtered conversations ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return conversations
    const q = filterQuery.toLowerCase()
    return conversations.filter(c =>
      normaliseName(c.resolvedName ?? '').toLowerCase().includes(q) ||
      c.booking?.service?.title?.toLowerCase().includes(q) ||
      c.lastMsg?.toLowerCase().includes(q)
    )
  }, [conversations, filterQuery])

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">

      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>

        {role === 'customer' && (
          <div ref={searchRef} className="relative">
            {showSearch ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 w-72">
                  <Search size={15} className="shrink-0 text-gray-400" />
                  <input
                    autoFocus
                    placeholder="Search providers…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  />
                  {searching
                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-primary shrink-0" />
                    : searchQuery && <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}><X size={13} className="text-gray-300 hover:text-gray-500" /></button>
                  }
                </div>
                {(searchResults.length > 0 || (searchQuery && !searching)) && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-100">
                    {searchResults.length === 0
                      ? <p className="px-4 py-4 text-sm text-gray-400 text-center">No providers found</p>
                      : searchResults.map(p => {
                          const pName = normaliseName(p.business_name || `${p.first_name} ${p.last_name}`.trim() || 'Provider')
                          const pInitials = initials(pName)
                          const colour = avatarColour(pName)
                          return (
                            <button key={p.id} onClick={() => startConversation(p)} disabled={starting}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:opacity-60">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${colour}`}>
                                {p.profile_image_url
                                  ? <img src={p.profile_image_url} alt="" className="h-9 w-9 object-cover" />
                                  : pInitials}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">{pName}</p>
                                {p.trade_category && (
                                  <p className="truncate text-xs text-gray-400 capitalize">{p.trade_category.replace(/_/g, ' ')}</p>
                                )}
                              </div>
                            </button>
                          )
                        })}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors">
                <Plus size={15} /> New Message
              </button>
            )}
          </div>
        )}
      </div>

      {startError && (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {startError}
        </div>
      )}

      {/* ── Conversation filter search bar ── */}
      {conversations.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            placeholder="Search conversations…"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          {filterQuery && (
            <button onClick={() => setFilterQuery('')}>
              <X size={13} className="text-gray-300 hover:text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* ── Conversation list ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 && conversations.length === 0 ? (
          /* Empty state — no conversations at all */
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="rounded-3xl bg-gray-50 p-6">
              <MessageSquare size={32} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">No conversations yet</p>
              <p className="mt-1 text-xs text-gray-400">
                {role === 'customer' ? 'Start a conversation with a verified provider.' : 'Conversations will appear here when customers message you.'}
              </p>
            </div>
            {role === 'customer' && (
              <button onClick={() => setShowSearch(true)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
                Message a Provider
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          /* Filter returned nothing */
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Search size={20} className="text-gray-300" />
            <p className="text-sm text-gray-400">No conversations match &ldquo;{filterQuery}&rdquo;</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 divide-y divide-gray-50">
            {filtered.map(c => {
              const name   = normaliseName(c.resolvedName ?? (role === 'provider' ? 'Customer' : 'Provider'))
              const ini    = initials(name)
              const colour = avatarColour(name)
              const time   = formatConversationTime(c.last_message_at)
              const isNew  = c.last_message_at && (Date.now() - new Date(c.last_message_at).getTime()) < 86400000
              const serviceTag = c.booking?.service?.title ?? c.booking?.booking_number ?? null

              return (
                <Link key={c.id} href={'/messages/' + c.id}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/70">

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-sm font-bold ${colour}`}>
                      {c.resolvedAvatar
                        ? <img src={c.resolvedAvatar} alt={name} className="h-12 w-12 object-cover" />
                        : ini}
                    </div>
                    {/* Online / recent dot */}
                    {isNew && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
                    )}
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm font-semibold text-gray-900 ${isNew ? 'font-bold' : ''}`}>
                        {name}
                      </p>
                      <span className="shrink-0 text-xs text-gray-400 whitespace-nowrap">{time}</span>
                    </div>

                    {serviceTag && (
                      <span className="mb-0.5 inline-block rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary/80">
                        {serviceTag}
                      </span>
                    )}

                    <p className={`truncate text-xs leading-relaxed ${isNew ? 'font-medium text-gray-700' : 'text-gray-400'}`}>
                      {c.lastMsg ?? <span className="italic text-gray-300">No messages yet</span>}
                    </p>
                  </div>

                  {/* Unread badge */}
                  {isNew && (
                    <div className="shrink-0">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
