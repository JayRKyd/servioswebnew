'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type QuoteRequest = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'closed' | 'expired'
  scheduled_date: string | null
  created_at: string
  _myResponseStatus?: 'pending' | 'accepted' | 'rejected' | null
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
}

const RESPONSE_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default function ProviderQuotesPage() {
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'responded' | 'won' | 'lost' | 'expired'>('all')

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)

      // Get quote request IDs this provider was invited to
      const { data: invites } = await supabase
        .from('quote_request_providers')
        .select('quote_request_id')
        .eq('provider_id', user!.id)

      if (!invites || invites.length === 0) {
        setQuotes([])
        setLoading(false)
        return
      }

      const ids = invites.map((i: { quote_request_id: string }) => i.quote_request_id)

      // Fetch requests + my responses
      const [{ data: requests }, { data: myResponses }] = await Promise.all([
        supabase
          .from('quote_requests')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: false }),
        supabase
          .from('quote_responses')
          .select('quote_request_id, status')
          .eq('provider_id', user!.id)
          .in('quote_request_id', ids),
      ])

      const responseMap: Record<string, 'pending' | 'accepted' | 'rejected'> = {}
      ;(myResponses ?? []).forEach((r: { quote_request_id: string; status: 'pending' | 'accepted' | 'rejected' }) => {
        responseMap[r.quote_request_id] = r.status
      })

      let result = (requests ?? []).map((q: QuoteRequest) => ({
        ...q,
        _myResponseStatus: responseMap[q.id] ?? null,
      }))

      if (filter === 'open') {
        result = result.filter((q: QuoteRequest) => q.status === 'open' && !q._myResponseStatus)
      } else if (filter === 'responded') {
        result = result.filter((q: QuoteRequest) => q._myResponseStatus != null)
      } else if (filter === 'won') {
        result = result.filter((q: QuoteRequest) => q._myResponseStatus === 'accepted')
      } else if (filter === 'lost') {
        result = result.filter((q: QuoteRequest) => q._myResponseStatus != null && q._myResponseStatus !== 'accepted' && q.status === 'closed')
      } else if (filter === 'expired') {
        result = result.filter((q: QuoteRequest) => q.status === 'expired')
      }

      setQuotes(result)
      setLoading(false)
    }
    load()
  }, [user?.id, filter])

  const TABS = [
    { key: 'all',       label: 'All' },
    { key: 'open',      label: 'Awaiting Response' },
    { key: 'responded', label: 'Responded' },
    { key: 'won',       label: 'Won' },
    { key: 'lost',      label: 'Lost' },
    { key: 'expired',   label: 'Expired' },
  ] as const

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Quote Requests</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={
              'pb-2 px-3 text-sm font-medium transition ' +
              (filter === t.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 text-sm">
          No quote requests here yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={'/provider/quotes/' + q.id}
                className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 hover:ring-blue-200 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{q.title}</p>
                    {q.description && (
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{q.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      {q.scheduled_date && <span>Preferred: {q.scheduled_date}</span>}
                      <span>{new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className={
                        'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                        (STATUS_STYLES[q.status] ?? 'bg-gray-100 text-gray-600')
                      }
                    >
                      {q.status}
                    </span>
                    {q._myResponseStatus ? (
                      <span
                        className={
                          'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                          (RESPONSE_BADGE[q._myResponseStatus] ?? '')
                        }
                      >
                        Quote {q._myResponseStatus}
                      </span>
                    ) : q.status === 'open' ? (
                      <span className="text-xs font-medium text-primary">Respond →</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
