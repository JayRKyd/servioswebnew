'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function AdminLandlordsPage() {
  const [landlords, setLandlords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('landlord_profiles').select('*, properties(id)').order('created_at', { ascending: false })
      .then(({ data }) => { setLandlords(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Landlords</h1>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Properties</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {landlords.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.first_name} {l.last_name}</td>
                  <td className="px-4 py-3 text-gray-500">{l.company_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{l.properties?.length ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
