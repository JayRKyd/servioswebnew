'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

export default function AdminPhotoModerationPage() {
  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    setLoading(true)
    supabase
      .from('booking_photos')
      .select(`
        id, storage_path, type, caption, marketing_consent, created_at, moderation_status,
        booking:bookings(booking_number, provider_id,
          provider_profile:provider_profiles(business_name, first_name, last_name)
        )
      `)
      .eq('marketing_consent', true)
      .eq('moderation_status', filter)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        if (!data) { setPhotos([]); setLoading(false); return }
        // Fetch signed URLs
        const withUrls = await Promise.all(
          data.map(async (p: any) => {
            const { data: signed } = await supabase.storage
              .from('booking-photos')
              .createSignedUrl(p.storage_path, 3600)
            return { ...p, signed_url: signed?.signedUrl ?? '' }
          })
        )
        setPhotos(withUrls)
        setLoading(false)
      })
  }, [filter])

  async function moderate(id: string, status: 'approved' | 'rejected') {
    setActing(id)
    await supabase
      .from('booking_photos')
      .update({ moderation_status: status })
      .eq('id', id)
    setPhotos(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }

  const providerName = (p: any) => {
    const prof = p.booking?.provider_profile
    return prof?.business_name ?? `${prof?.first_name ?? ''} ${prof?.last_name ?? ''}`.trim() ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Photo Moderation</h1>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ' +
                (filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : photos.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 capitalize">No {filter} photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map(photo => (
            <div key={photo.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              {photo.signed_url && (
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.signed_url}
                    alt={photo.caption ?? 'Job photo'}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize ' +
                    (photo.type === 'after' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')
                  }>
                    {photo.type}
                  </span>
                  <span className="text-xs text-gray-400">{photo.booking?.booking_number}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{providerName(photo)}</p>
                {photo.caption && <p className="text-xs text-gray-500 line-clamp-2">{photo.caption}</p>}
                {filter === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => moderate(photo.id, 'approved')}
                      disabled={acting === photo.id}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => moderate(photo.id, 'rejected')}
                      disabled={acting === photo.id}
                      className="flex-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
