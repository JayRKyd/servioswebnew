'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

interface ContentPhoto {
  id: string
  signed_url: string
  url: string
  storage_path: string
  type: 'before' | 'after'
  caption: string | null
  consent_given_at: string
  created_at: string
  booking: {
    id: string
    booking_number: string
    service: { title: string; category: string } | null
  } | null
  uploader: {
    provider_profiles: { first_name: string; last_name: string; business_name: string | null }[]
  } | null
}

type QueueStatus = 'pending' | 'approved' | 'rejected'

interface QueueEntry {
  photo: ContentPhoto
  status: QueueStatus
  notes: string
}

export default function AdminContentQueuePage() {
  const [photos, setPhotos] = useState<ContentPhoto[]>([])
  const [queue, setQueue] = useState<Record<string, QueueEntry>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [lightbox, setLightbox] = useState<ContentPhoto | null>(null)

  useEffect(() => {
    // Fetch all photos with marketing_consent = true
    supabase
      .from('booking_photos')
      .select(`
        id, url, storage_path, type, caption, consent_given_at, created_at,
        booking:bookings(id, booking_number, service:services(title, category)),
        uploader:auth.users!uploaded_by(provider_profiles(first_name, last_name, business_name))
      `)
      .eq('marketing_consent', true)
      .order('consent_given_at', { ascending: false })
      .then(async ({ data }) => {
        const raw = data ?? []
        // Generate signed URLs
        const withSigned = await Promise.all(raw.map(async (p: any) => {
          const { data: signed } = await supabase.storage.from('booking-photos').createSignedUrl(p.storage_path, 3600)
          return { ...p, signed_url: signed?.signedUrl ?? p.url }
        }))
        setPhotos(withSigned as ContentPhoto[])
        // Init queue state — in real app this would come from a DB table
        const initial: Record<string, QueueEntry> = {}
        withSigned.forEach((p: any) => {
          initial[p.id] = { photo: p, status: 'pending', notes: '' }
        })
        setQueue(initial)
        setLoading(false)
      })
  }, [])

  function setStatus(photoId: string, status: QueueStatus) {
    setQueue(q => ({ ...q, [photoId]: { ...q[photoId], status } }))
  }

  function setNotes(photoId: string, notes: string) {
    setQueue(q => ({ ...q, [photoId]: { ...q[photoId], notes } }))
  }

  const filtered = photos.filter(p => {
    if (filter === 'all') return true
    return queue[p.id]?.status === filter
  })

  const counts = {
    all: photos.length,
    pending: Object.values(queue).filter(e => e.status === 'pending').length,
    approved: Object.values(queue).filter(e => e.status === 'approved').length,
    rejected: Object.values(queue).filter(e => e.status === 'rejected').length,
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-6">
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-h-full max-w-3xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.signed_url} alt={lightbox.caption ?? 'Photo'} className="max-h-[80vh] max-w-full rounded-xl object-contain" />
            {lightbox.caption && <p className="mt-2 text-center text-sm text-white">{lightbox.caption}</p>}
            <button onClick={() => setLightbox(null)} className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg text-xs font-bold">✕</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Photos providers consented to feature on social media</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{counts.pending} pending review</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={'pb-2 px-2 text-sm font-medium capitalize border-b-2 transition ' +
              (filter === f ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400">No photos in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(photo => {
            const entry = queue[photo.id]
            const provider = photo.uploader?.provider_profiles?.[0]
            const providerName = provider?.business_name ?? `${provider?.first_name ?? ''} ${provider?.last_name ?? ''}`.trim() || 'Unknown provider'
            return (
              <div key={photo.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                {/* Photo */}
                <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => setLightbox(photo)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.signed_url} alt={photo.caption ?? 'Job photo'}
                    className="h-full w-full object-cover hover:opacity-95 transition" />
                  <span className={'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ' +
                    (photo.type === 'after' ? 'bg-green-600 text-white' : 'bg-gray-700 text-white')}>
                    {photo.type}
                  </span>
                  <span className={'absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold ' +
                    (entry?.status === 'approved' ? 'bg-green-100 text-green-700' :
                     entry?.status === 'rejected' ? 'bg-red-100 text-red-700' :
                     'bg-yellow-100 text-yellow-700')}>
                    {entry?.status ?? 'pending'}
                  </span>
                </div>

                {/* Meta */}
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{providerName}</p>
                    <p className="text-xs text-gray-400">{photo.booking?.service?.title ?? 'Unknown service'} · {formatDate(photo.consent_given_at)}</p>
                    {photo.caption && <p className="text-xs text-gray-500 mt-1 italic">"{photo.caption}"</p>}
                  </div>

                  {/* Notes */}
                  <textarea
                    rows={2}
                    value={entry?.notes ?? ''}
                    onChange={e => setNotes(photo.id, e.target.value)}
                    placeholder="Internal notes (optional)…"
                    className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                  />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(photo.id, 'approved')}
                      className={'flex-1 rounded-lg py-2 text-xs font-semibold transition ' +
                        (entry?.status === 'approved'
                          ? 'bg-green-600 text-white'
                          : 'border border-green-300 text-green-700 hover:bg-green-50')}>
                      ✓ Approve
                    </button>
                    <button onClick={() => setStatus(photo.id, 'rejected')}
                      className={'flex-1 rounded-lg py-2 text-xs font-semibold transition ' +
                        (entry?.status === 'rejected'
                          ? 'bg-red-600 text-white'
                          : 'border border-red-300 text-red-700 hover:bg-red-50')}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
