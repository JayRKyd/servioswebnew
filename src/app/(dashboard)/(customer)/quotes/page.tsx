'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquareQuote } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

type QuoteRequest = {
  id: string
  title: string
  description: string | null
  status: 'open' | 'closed' | 'expired'
  created_at: string
  _responseCount: number
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  expired: 'bg-red-100 text-red-600',
}

export default function CustomerQuotesPage() {
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: requests } = await supabase
        .from('quote_requests')
        .select('id, title, description, status, created_at')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false })

      const ids = (requests ?? []).map((r: any) => r.id)
      let counts: Record<string, number> = {}
      if (ids.length > 0) {
        const { data: resps } = await supabase
          .from('quote_responses')
          .select('quote_request_id')
          .in('quote_request_id', ids)
        for (const r of resps ?? []) {
          counts[r.quote_request_id] = (counts[r.quote_request_id] ?? 0) + 1
        }
      }
      setQuotes((requests ?? []).map((r: any) => ({ ...r, _responseCount: counts[r.id] ?? 0 })))
      setLoading(false)
    }
    load()
  }, [user?.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Quotes</h1>
        <Link href="/book" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
          Get new quotes
        </Link>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/[0.08]">
            <MessageSquareQuote size={22} className="text-primary" />
          </div>
          <p className="mt-1 font-semibold text-gray-900">No quote requests yet</p>
          <p className="max-w-xs text-sm text-gray-500">
            Describe your job in Get Quotes and local pros will send you their prices.
          </p>
          <Link href="/book" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
            Get Quotes
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link href={`/quotes/${q.id}`} className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 hover:ring-primary/30 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{q.title}</p>
                    {q.description && <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{q.description}</p>}
                    <p className="mt-2 text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_STYLES[q.status] ?? 'bg-gray-100 text-gray-600')}>
                      {q.status}
                    </span>
                    <span className={'text-xs font-medium ' + (q._responseCount > 0 ? 'text-primary' : 'text-gray-400')}>
                      {q._responseCount} quote{q._responseCount !== 1 ? 's' : ''} received
                    </span>
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
