'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('invitations').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setInvitations(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invitations.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.email}</td>
                  <td className="px-4 py-3"><span className={'rounded-full px-2 py-0.5 text-xs capitalize ' + (inv.status === 'accepted' ? 'bg-green-100 text-green-700' : inv.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>{inv.status}</span></td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
