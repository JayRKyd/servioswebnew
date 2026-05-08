'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('bookings').select('*').or('customer_id.eq.' + id + ',provider_id.eq.' + id).order('created_at', { ascending: false }).limit(10),
    ]).then(([{ data: u }, { data: b }]) => { setUser(u); setBookings(b ?? []); setLoading(false) })
  }, [id])

  async function toggleActive() {
    await supabase.from('users').update({ is_active: !user.is_active }).eq('id', id)
    setUser((u: any) => ({ ...u, is_active: !u.is_active }))
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!user) return <div className="text-gray-400">User not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{user.email}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[['Roles', user.roles?.join(', ')], ['Active Role', user.active_role], ['Phone', user.phone ?? '—'], ['Joined', formatDate(user.created_at)], ['Status', user.is_active ? 'Active' : 'Suspended']].map(([label, val]) => (
            <div key={label as string}><p className="text-xs text-gray-400">{label}</p><p className="font-medium capitalize">{val as string}</p></div>
          ))}
        </div>
        <div className="border-t pt-4">
          <button onClick={toggleActive} className={'rounded-lg px-4 py-2 text-sm font-medium ' + (user.is_active ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'bg-green-600 text-white hover:bg-green-700')}>
            {user.is_active ? 'Suspend User' : 'Activate User'}
          </button>
        </div>
      </div>
      {bookings.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Recent Activity</h2>
          <div className="space-y-2">
            {bookings.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100">
                <div><p className="text-sm font-medium text-gray-900">{b.booking_number}</p><p className="text-xs text-gray-400">{formatDate(b.scheduled_date)}</p></div>
                <span className="text-xs capitalize text-gray-500">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
