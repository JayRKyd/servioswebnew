'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'

export default function ProviderDetailForLandlordPage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('provider_profiles').select('*').eq('user_id', id).maybeSingle().then(({ data }) => { setProfile(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return <div className="text-gray-400">Provider not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{profile.business_name}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div>
          <p className="font-semibold text-gray-900">{profile.first_name} {profile.last_name}</p>
          {profile.is_verified && <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Verified</span>}
        </div>
        {profile.bio && <p className="text-sm text-gray-600 border-t pt-4">{profile.bio}</p>}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {profile.hourly_rate && <div><p className="text-xs text-gray-400">Rate</p><p className="font-medium">USD {profile.hourly_rate}/hr</p></div>}
          {profile.rating_count > 0 && <div><p className="text-xs text-gray-400">Rating</p><p className="font-medium">{profile.rating_average?.toFixed(1)} ({profile.rating_count})</p></div>}
          {profile.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{profile.phone}</p></div>}
        </div>
      </div>
    </div>
  )
}
