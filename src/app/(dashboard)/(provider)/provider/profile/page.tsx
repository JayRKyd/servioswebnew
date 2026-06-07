'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

interface GalleryPhoto {
  id: string
  photo_url: string
  caption: string | null
  photo_type: 'before' | 'after' | 'during'
}

export default function ProviderProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [gallery, setGallery] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: p } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      setProfile(p)

      if (p?.id) {
        // Get provider's completed booking IDs
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('provider_id', p.id)
          .eq('status', 'completed')

        const bookingIds = (bookings ?? []).map((b: any) => b.id)

        if (bookingIds.length > 0) {
          const { data: photos } = await supabase
            .from('booking_photos')
            .select('id, photo_url, caption, photo_type')
            .in('booking_id', bookingIds)
            .eq('moderation_status', 'approved')
            .eq('marketing_consent', true)
            .order('created_at', { ascending: false })
            .limit(12)
          setGallery(photos ?? [])
        }
      }

      setLoading(false)
    }
    load()
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return (
    <div className="text-gray-400">
      Profile not found.{' '}
      <Link href="/provider/profile/edit" className="text-primary hover:underline">Create your profile →</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link href="/provider/profile/edit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Edit Profile</Link>
      </div>

      {/* Profile card */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        <div className="flex items-center gap-4">
          {profile.profile_image_url ? (
            <img src={profile.profile_image_url} alt={profile.business_name} className="h-16 w-16 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
              {(profile.business_name ?? profile.first_name ?? '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.business_name}</p>
            <p className="text-sm text-gray-500">{profile.first_name} {profile.last_name}</p>
            {profile.is_verified && (
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">✓ Verified</span>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">Bio</p>
            <p className="text-sm text-gray-700">{profile.bio}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {profile.hourly_rate && <div><p className="text-xs text-gray-400">Hourly Rate</p><p className="font-medium">£{profile.hourly_rate}/hr</p></div>}
          {profile.rating_count > 0 && <div><p className="text-xs text-gray-400">Rating</p><p className="font-medium">{profile.rating_average?.toFixed(1)} ({profile.rating_count} reviews)</p></div>}
          {profile.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium">{profile.phone}</p></div>}
          {profile.website && <div><p className="text-xs text-gray-400">Website</p><p className="font-medium text-primary">{profile.website}</p></div>}
        </div>

        {profile.service_areas?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-2">Service Areas</p>
            <div className="flex flex-wrap gap-2">
              {profile.service_areas.map((area: string) => (
                <span key={area} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary">{area}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Work gallery */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Work Gallery</h2>
            <p className="text-xs text-gray-400 mt-0.5">Approved before/after photos from completed jobs</p>
          </div>
          {gallery.length > 0 && (
            <span className="text-xs text-gray-400">{gallery.length} photo{gallery.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
            <Camera size={28} className="text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-500">No approved photos yet</p>
            <p className="mt-1 text-xs text-gray-400 max-w-xs">
              Upload before/after photos on completed bookings. Once approved by the Servios team they'll appear here and on your public profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map(photo => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                <img
                  src={photo.photo_url}
                  alt={photo.caption ?? photo.photo_type}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur-sm">
                    {photo.photo_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
