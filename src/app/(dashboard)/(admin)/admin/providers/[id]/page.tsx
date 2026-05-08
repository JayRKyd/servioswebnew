'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function AdminProviderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('provider_profiles').select('*').eq('user_id', id).maybeSingle().then(({ data: p }) => {
      setProfile(p)
      if (p?.id) {
        supabase.from('provider_documents').select('*').eq('provider_id', p.id).order('created_at', { ascending: false })
          .then(({ data: d }) => { setDocs(d ?? []); setLoading(false) })
      } else {
        setLoading(false)
      }
    })
  }, [id])

  async function toggleVerified() {
    const val = !profile.is_verified
    await supabase.from('provider_profiles').update({
      is_verified: val,
      verified_at: val ? new Date().toISOString() : null,
      verification_status: val ? 'verified' : 'pending',
    }).eq('user_id', id)
    if (val) {
      await supabase.from('notifications').insert({
        user_id: id,
        notification_type: 'account_verified',
        title: 'Your account has been verified!',
        body: 'Your provider account is now verified and you\'re live on Servios.',
      })
    }
    setProfile((p: any) => ({ ...p, is_verified: val, verification_status: val ? 'verified' : 'pending' }))
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return <div className="text-gray-400">Provider not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{profile.business_name}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{profile.first_name} {profile.last_name}</p>
            {profile.bio && <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>}
          </div>
          <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (profile.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
            {profile.is_verified ? 'Verified' : 'Unverified'}
          </span>
        </div>
        {docs.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-900 mb-3">Documents</p>
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div><p className="text-sm font-medium text-gray-900">{d.title}</p><p className="text-xs text-gray-400 capitalize">{d.document_type}</p></div>
                  <span className={'rounded-full px-2 py-0.5 text-xs capitalize ' + (d.status === 'verified' ? 'bg-green-100 text-green-700' : d.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="border-t pt-4">
          <button onClick={toggleVerified} className={'rounded-lg px-4 py-2 text-sm font-medium ' + (profile.is_verified ? 'border border-red-300 text-red-600 hover:bg-red-50' : 'bg-green-600 text-white hover:bg-green-700')}>
            {profile.is_verified ? 'Revoke Verification' : 'Verify Provider'}
          </button>
        </div>
      </div>
    </div>
  )
}
