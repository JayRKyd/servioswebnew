'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let q = supabase.from('provider_profiles').select('*').order('created_at', { ascending: false })
    if (filter === 'pending') q = q.eq('is_verified', false).eq('is_active', true)
    else if (filter === 'verified') q = q.eq('is_verified', true)
    else if (filter === 'inactive') q = q.eq('is_active', false)
    q.then(({ data }) => { setProviders(data ?? []); setLoading(false) })
  }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
        <Link href="/admin/providers/verification" className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600">Verification Queue</Link>
      </div>
      <div className="flex gap-2">
        {['all', 'pending', 'verified', 'inactive'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'rounded-full px-3 py-1.5 text-xs font-medium transition capitalize ' + (filter === f ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-primary/30')}>{f}</button>
        ))}
      </div>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.business_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.first_name} {p.last_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.rating_average > 0 ? p.rating_average.toFixed(1) + ' (' + p.rating_count + ')' : '—'}</td>
                  <td className="px-4 py-3"><span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + (p.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>{p.is_verified ? 'Verified' : 'Pending'}</span></td>
                  <td className="px-4 py-3"><Link href={'/admin/providers/' + p.user_id} className="text-primary hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
