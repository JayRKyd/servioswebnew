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
  property_id: string | null
  service_id: string | null
  _responseCount?: number
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
}

export default function LandlordQuotesPage() {
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'expired'>('all')

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      let q = supabase
        .from('quote_requests')
        .select('*')
        .eq('landlord_id', user!.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') q = q.eq('status', filter)

      const { data } = await q
      if (!data) { setLoading(false); return }

      // fetch response counts
      const ids = data.map((r: QuoteRequest) => r.id)
      const { data: counts } = ids.length
        ? await supabase
            .from('quote_responses')
            .select('quote_request_id')
            .in('quote_request_id', ids)
        : { data: [] }

      const countMap: Record<string, number> = {}
      ;(counts ?? []).forEach((r: { quote_request_id: string }) => {
        countMap[r.quote_request_id] = (countMap[r.quote_request_id] ?? 0) + 1
      })

      setQuotes(data.map((q: QuoteRequest) => ({ ...q, _responseCount: countMap[q.id] ?? 0 })))
      setLoading(false)
    }
    load()
  }, [user?.id, filter])

  const TABS = ['all', 'open', 'closed', 'expired'] as const

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quote Requests</h1>
        <Link
          href="/landlord/quotes/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          + New Request
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={
              'pb-2 px-3 text-sm font-medium capitalize transition ' +
              (filter === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-700')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500">No quote requests yet.</p>
          <Link
            href="/landlord/quotes/new"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Create your first request
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={'/landlord/quotes/' + q.id}
                className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 hover:ring-primary/30 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{q.title}</p>
                    {q.description && (
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{q.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      {q.scheduled_date && <span>Scheduled: {q.scheduled_date}</span>}
                      <span>{q._responseCount} response{q._responseCount !== 1 ? 's' : ''}</span>
                      <span>Created {new Date(q.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span
                    className={
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                      (STATUS_STYLES[q.status] ?? 'bg-gray-100 text-gray-600')
                    }
                  >
                    {q.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
