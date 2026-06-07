'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'

interface BookingPhoto {
  id: string
  url: string
  signed_url: string
  type: 'before' | 'after'
  caption: string | null
  created_at: string
  marketing_consent: boolean
  storage_path: string
}

interface BookingPhotosProps {
  bookingId: string
  bookingStatus: string
  isProvider: boolean
  onAfterPhotoCount?: (count: number) => void
}

export function BookingPhotos({ bookingId, bookingStatus, isProvider, onAfterPhotoCount }: BookingPhotosProps) {
  const [photos, setPhotos] = useState<BookingPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<'before' | 'after'>('before')
  const [caption, setCaption] = useState('')
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [lightbox, setLightbox] = useState<BookingPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const canUpload = isProvider && ['in_progress', 'completed'].includes(bookingStatus)

  async function loadPhotos() {
    const { data } = await supabase
      .from('booking_photos')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at')
    if (!data) { setLoading(false); return }
    const withUrls: BookingPhoto[] = await Promise.all(data.map(async (p) => {
      const { data: signed } = await supabase.storage.from('booking-photos').createSignedUrl(p.storage_path, 3600)
      return { ...p, url: p.storage_path, signed_url: signed?.signedUrl ?? '' }
    }))
    setPhotos(withUrls)
    onAfterPhotoCount?.(withUrls.filter(p => p.type === 'after').length)
    setLoading(false)
  }

  useEffect(() => { loadPhotos() }, [bookingId])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${bookingId}/${uploadType}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('booking-photos').upload(storagePath, file, { contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('booking-photos').getPublicUrl(storagePath)
      const { error: insertErr } = await supabase.from('booking_photos').insert({
        booking_id: bookingId,
        uploaded_by: user?.id,
        storage_path: storagePath,
        url: urlData.publicUrl,
        type: uploadType,
        caption: caption.trim() || null,
        marketing_consent: marketingConsent,
        consent_given_at: marketingConsent ? new Date().toISOString() : null,
      })
      if (insertErr) throw insertErr
      setCaption('')
      if (fileRef.current) fileRef.current.value = ''
      await loadPhotos()
    } catch (e: any) {
      alert('Upload failed: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(photo: BookingPhoto) {
    await supabase.storage.from('booking-photos').remove([photo.storage_path])
    await supabase.from('booking_photos').delete().eq('id', photo.id)
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  const beforePhotos = photos.filter((p) => p.type === 'before')
  const afterPhotos = photos.filter((p) => p.type === 'after')

  if (loading) return null
  if (!canUpload && photos.length === 0) return null

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Job Photos</h3>

      {/* Upload panel — provider only */}
      {canUpload && (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(['before', 'after'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setUploadType(t)}
                  className={
                    'px-3 py-1.5 font-medium capitalize transition ' +
                    (uploadType === t ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary"
            />
            <span className="text-xs text-gray-500">
              Allow Servios to feature this work on social media
            </span>
          </label>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Uploading…
                </>
              ) : (
                <>📷 Add {uploadType} photo</>
              )}
            </button>
            <span className="text-xs text-gray-400">JPG, PNG, WEBP — max 10 MB</span>
          </div>
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="space-y-4">
          {[
            { label: 'Before', list: beforePhotos },
            { label: 'After', list: afterPhotos },
          ].map(({ label, list }) =>
            list.length > 0 ? (
              <div key={label}>
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {list.map((photo) => (
                    <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.signed_url}
                        alt={photo.caption ?? `${label} photo`}
                        className="h-full w-full cursor-pointer object-cover transition group-hover:opacity-90"
                        onClick={() => setLightbox(photo)}
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                          <p className="truncate text-[10px] text-white">{photo.caption}</p>
                        </div>
                      )}
                      {canUpload && (
                        <button
                          onClick={() => handleDelete(photo)}
                          className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:flex items-center justify-center"
                          title="Delete"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.signed_url}
              alt={lightbox.caption ?? 'Photo'}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            {lightbox.caption && (
              <p className="mt-2 text-center text-sm text-white">{lightbox.caption}</p>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
