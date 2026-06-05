'use client'
import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { BADGE_LABELS } from '@/lib/document-requirements'

interface ProviderService {
  service: { title: string; category: string }
}

interface Review {
  rating: number
  comment: string | null
  reviewer_name: string
  reviewer_id: string | null
}

interface ProviderProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  business_name: string | null
  bio: string | null
  trade_category: string | null
  hourly_rate: number | null
  rating_average: number
  total_reviews: number
  verification_status: string
  service_areas: string[] | null
  profile_image_url: string | null
  services: ProviderService[]
  reviews: Review[]
}

function Stars({ rating }: { rating: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

export default function CustomerProviderProfilePage() {
  return <Suspense fallback={null}><CustomerProviderProfileInner /></Suspense>
}
function CustomerProviderProfileInner() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const context = searchParams.get('context') ?? ''
  const [provider, setProvider] = useState<ProviderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [messaging, setMessaging] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState<{ signed_url: string; caption: string | null; type: string }[]>([])
  const [verifiedBadges, setVerifiedBadges] = useState<string[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)

  async function handleMessage() {
    setMessaging(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: customerProfile } = await supabase.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!customerProfile || !provider) { setMessaging(false); return }

    // Find existing conversation between this customer and provider
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', customerProfile.id)
      .eq('provider_id', provider.id)
      .is('booking_id', null)
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      return
    }

    // Create new conversation
    const { data: conv } = await supabase.from('conversations').insert({
      customer_id: customerProfile.id,
      provider_id: provider.id,
      conversation_type: 'direct',
      status: 'active',
    }).select('id').single()
    setMessaging(false)
    if (conv) router.push(`/messages/${conv.id}`)
  }

  useEffect(() => {
    async function load() {
      const { data: pp } = await supabase
        .from('provider_profiles')
        .select('id, user_id, first_name, last_name, business_name, bio, trade_category, hourly_rate, rating_average, total_reviews, verification_status, service_areas, profile_image_url')
        .eq('user_id', id as string)
        .maybeSingle()
      if (!pp) { setLoading(false); return }

      const [{ data: svcs }, { data: revs }] = await Promise.all([
        supabase.from('provider_services')
          .select('service:services(title, service_categories(name))')
          .eq('provider_id', pp.id).eq('is_active', true),
        supabase.from('reviews')
          .select('rating, comment, reviewer_id')
          .eq('provider_id', pp.user_id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Resolve reviewer names from customer_profiles
      const reviewerIds = Array.from(new Set((revs ?? []).map((r: any) => r.reviewer_id).filter(Boolean)))
      let reviewerNameMap: Record<string, string> = {}
      if (reviewerIds.length > 0) {
        const { data: cps } = await supabase
          .from('customer_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', reviewerIds)
        cps?.forEach((cp: any) => {
          reviewerNameMap[cp.user_id] = `${cp.first_name} ${cp.last_name}`.trim() || 'Customer'
        })
      }

      setProvider({
        ...pp,
        services: (svcs ?? []).map((s: any) => ({ service: { title: s.service?.title, category: s.service?.service_categories?.name ?? '' } })),
        reviews: (revs ?? []).map((r: any) => ({
          rating:        r.rating,
          comment:       r.comment,
          reviewer_id:   r.reviewer_id,
          reviewer_name: reviewerNameMap[r.reviewer_id] ?? 'Customer',
        })),
      })

      // Load approved gallery photos
      const { data: bookingIds } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', pp.id)
      const bids = (bookingIds ?? []).map((b: any) => b.id)
      if (bids.length > 0) {
        const { data: photos } = await supabase
          .from('booking_photos')
          .select('storage_path, caption, type')
          .eq('moderation_status', 'approved')
          .in('booking_id', bids)
          .order('created_at', { ascending: false })
          .limit(12)
        if (photos && photos.length > 0) {
          const withUrls = await Promise.all(photos.map(async (p: any) => {
            const { data: signed } = await supabase.storage
              .from('booking-photos')
              .createSignedUrl(p.storage_path, 3600)
            return { ...p, signed_url: signed?.signedUrl ?? '' }
          }))
          setGalleryPhotos(withUrls.filter(p => p.signed_url))
        }
      }

      // Load approved document badges
      const { data: docs } = await supabase
        .from('provider_documents')
        .select('document_type')
        .eq('provider_id', id as string)
        .eq('status', 'approved')
      setVerifiedBadges(Array.from(new Set((docs ?? []).map((d: any) => d.document_type))))

      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Provider not found.</p>
        <button onClick={() => router.back()} className="mt-4 text-primary hover:underline text-sm">← Go back</button>
      </div>
    )
  }

  const displayName = provider.business_name ?? `${provider.first_name} ${provider.last_name}`
  const uniqueCategories = Array.from(new Set(provider.services.map(sv => sv.service.category)))

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>

      {/* Header card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 flex gap-5 items-start">
        {provider.profile_image_url ? (
          <img
            src={provider.profile_image_url}
            alt={displayName}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
            {provider.verification_status === 'verified' && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">✓ Verified</span>
            )}
          </div>
          {verifiedBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {verifiedBadges.slice(0, 4).map(badge => (
                <span key={badge} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  ✓ {BADGE_LABELS[badge] ?? badge}
                </span>
              ))}
            </div>
          )}
          {provider.trade_category && (
            <p className="text-sm text-gray-500 capitalize">{provider.trade_category.replace(/_/g, ' ')}</p>
          )}
          <div className="flex items-center gap-2">
            <Stars rating={provider.rating_average} />
            <span className="text-sm text-gray-500">{provider.rating_average?.toFixed(1) ?? '0.0'} ({provider.total_reviews ?? 0} reviews)</span>
          </div>
          {uniqueCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {uniqueCategories.map(cat => (
                <span key={cat} className="rounded-md bg-primary/[0.06] px-2 py-0.5 text-xs text-primary capitalize">{cat}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {provider.bio && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{provider.bio}</p>
        </div>
      )}

      {/* Details */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Details</h2>
        {provider.hourly_rate != null && (
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Hourly rate</span>
            <span className="font-medium text-gray-900">£{provider.hourly_rate}/hr</span>
          </div>
        )}
        {provider.service_areas && provider.service_areas.length > 0 && (
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">Serves</span>
            <span className="font-medium text-gray-900">{provider.service_areas.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Services */}
      {provider.services.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Services</h2>
          <div className="space-y-2">
            {provider.services.map((sv, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-800">{sv.service.title}</span>
                <span className="text-xs text-gray-400 capitalize">{sv.service.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work Gallery */}
      {galleryPhotos.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Work Gallery</h2>
          <div className="grid grid-cols-3 gap-2">
            {galleryPhotos.map((photo, i) => (
              <div
                key={i}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100"
                onClick={() => setLightbox(photo.signed_url)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.signed_url}
                  alt={photo.caption ?? `Work photo ${i + 1}`}
                  className="h-full w-full object-cover transition group-hover:opacity-90"
                />
                {photo.type === 'after' && (
                  <span className="absolute bottom-1 right-1 rounded bg-green-600/80 px-1 py-0.5 text-[10px] font-medium text-white">After</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Work photo" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Reviews */}
      {provider.reviews && provider.reviews.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Reviews</h2>
          <div className="space-y-4">
            {provider.reviews.slice(0, 5).map((rv, i) => (
              <div key={i} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">{rv.reviewer_name}</span>
                  <Stars rating={rv.rating} />
                </div>
                {rv.comment && <p className="text-sm text-gray-500">{rv.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleMessage}
          disabled={messaging}
          className="flex-1 rounded-xl border border-primary py-3.5 text-center text-sm font-semibold text-primary hover:bg-primary/[0.06] disabled:opacity-50"
        >
          {messaging ? 'Opening…' : '💬 Message'}
        </button>
        <Link
          href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
          className="flex-1 rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Book this Provider
        </Link>
      </div>
    </div>
  )
}
