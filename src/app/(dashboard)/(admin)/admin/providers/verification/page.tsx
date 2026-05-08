'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

export default function ProviderVerificationPage() {
  const [providers, setProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('provider_profiles').select('*').eq('is_verified', false).eq('is_active', true).order('created_at', { ascending: true })
      .then(({ data }) => { setProviders(data ?? []); setLoading(false) })
  }, [])

  async function verify(userId: string) {
    setActing(userId)
    await supabase.from('provider_profiles').update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verification_status: 'verified',
    }).eq('user_id', userId)
    await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: 'account_verified',
      title: 'Your account has been verified!',
      body: 'Congratulations! Your provider account is now verified and you\'re live on Servios.',
    })
    setProviders(ps => ps.filter(p => p.user_id !== userId))
    setActing(null)
  }

  async function reject(userId: string) {
    setActing(userId)
    await supabase.from('provider_profiles').update({
      is_active: false,
      verification_status: 'rejected',
    }).eq('user_id', userId)
    await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: 'account_rejected',
      title: 'Verification unsuccessful',
      body: 'Your provider application was not approved. Please contact support for more information.',
    })
    setProviders(ps => ps.filter(p => p.user_id !== userId))
    setActing(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Verification Queue</h1>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        providers.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No providers pending verification</p></div> : (
          <div className="space-y-4">
            {providers.map(p => (
              <div key={p.id} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">{p.business_name}</p>
                  <p className="text-sm text-gray-500">{p.first_name} {p.last_name}</p>
                  {p.bio && <p className="mt-2 text-sm text-gray-600">{p.bio}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {p.hourly_rate && <div><p className="text-xs text-gray-400">Rate</p><p>USD {p.hourly_rate}/hr</p></div>}
                  {p.phone && <div><p className="text-xs text-gray-400">Phone</p><p>{p.phone}</p></div>}
                </div>
                <div className="flex gap-3 border-t pt-4">
                  <button onClick={() => verify(p.user_id)} disabled={acting === p.user_id} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
                  <button onClick={() => reject(p.user_id)} disabled={acting === p.user_id} className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
