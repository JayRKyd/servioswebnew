'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function ProviderProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => { setProfile(data); setLoading(false) })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return <div className="text-gray-400">Profile not found. <Link href="/provider/profile/edit" className="text-primary hover:underline">Create your profile →</Link></div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link href="/provider/profile/edit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Edit Profile</Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        <div>
          <p className="text-lg font-bold text-gray-900">{profile.business_name}</p>
          <p className="text-sm text-gray-500">{profile.first_name} {profile.last_name}</p>
          {profile.is_verified && <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Verified</span>}
        </div>
        {profile.bio && <div className="border-t pt-4"><p className="text-sm text-gray-500 mb-1">Bio</p><p className="text-sm text-gray-700">{profile.bio}</p></div>}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {profile.hourly_rate && <div><p className="text-xs text-gray-400">Hourly Rate</p><p className="font-medium">USD {profile.hourly_rate}</p></div>}
          {profile.rating_count > 0 && <div><p className="text-xs text-gray-400">Rating</p><p className="font-medium">{profile.rating_average?.toFixed(1)} ({profile.rating_count} reviews)</p></div>}
          {profile.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{profile.phone}</p></div>}
          {profile.website && <div><p className="text-xs text-gray-400">Website</p><p className="font-medium text-primary">{profile.website}</p></div>}
        </div>
        {profile.islands?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-2">Service Islands</p>
            <div className="flex flex-wrap gap-2">
              {profile.islands.map((island: string) => (
                <span key={island} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary">{island}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
