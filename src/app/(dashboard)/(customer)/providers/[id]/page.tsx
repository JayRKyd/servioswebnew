'use client'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { titleCase } from '@/lib/utils'
import {
  Star, BadgeCheck, MapPin, Clock, MessageSquare, CalendarCheck,
  Shield, ChevronLeft, ChevronRight, X, Grid2X2, Crown, Phone, Globe,
} from 'lucide-react'

interface PortfolioPhoto {
  id: string
  url: string
  caption: string | null
}

interface ProviderProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  business_name: string | null
  bio: string | null
  trade_category: string | null
  trade_categories: string[] | null
  hourly_rate: number | null
  rating_average: number
  total_reviews: number
  total_jobs_completed: number | null
  verification_status: string
  identity_verified: boolean
  service_areas: string[] | null
  profile_image_url: string | null
  created_at: string
  city: string | null
  avg_response_hours: number | null
  phone: string | null
  website: string | null
  badges: string[] | null
  licenses: string[] | null
  languages: string[] | null
}

interface ProviderService {
  id: string
  service: { title: string; description: string | null; base_price: number | null }
}

interface Review {
  id: string
  rating: number
  review_text: string | null
  created_at: string
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size}
          className={n <= Math.round(rating) ? 'fill-amber-400 stroke-amber-400' : 'fill-gray-200 stroke-gray-200'} />
      ))}
    </span>
  )
}

function relativeDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30) return `${diff} days ago`
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`
  return `${Math.floor(diff / 365)} years ago`
}

export default function CustomerProviderProfilePage() {
  return <Suspense fallback={null}><CustomerProviderProfileInner /></Suspense>
}

function CustomerProviderProfileInner() {
  const { id }       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const context      = searchParams.get('context') ?? ''

  const [provider, setProvider]               = useState<ProviderProfile | null>(null)
  const [services, setServices]               = useState<ProviderService[]>([])
  const [reviews, setReviews]                 = useState<Review[]>([])
  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([])
  const [loading, setLoading]                 = useState(true)
  const [messaging, setMessaging]             = useState(false)
  const [prefetchedConvId, setPrefetchedConvId]         = useState<string | null>(null)
  const [prefetchedCustomerId, setPrefetchedCustomerId] = useState<string | null>(null)
  const [bioExpanded, setBioExpanded]         = useState(false)
  const [showAllReviews, setShowAllReviews]   = useState(false)
  const [stickyVisible, setStickyVisible]     = useState(false)
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [lightboxIdx, setLightboxIdx]           = useState<number | null>(null)

  const galleryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: pp } = await supabase
        .from('provider_profiles')
        .select('id, user_id, first_name, last_name, business_name, bio, trade_category, trade_categories, hourly_rate, rating_average, total_reviews, total_jobs_completed, verification_status, identity_verified, service_areas, profile_image_url, created_at, city, avg_response_hours, phone, website, badges, licenses, languages')
        .eq('user_id', id as string)
        .maybeSingle()

      if (!pp) { setLoading(false); return }
      setProvider(pp)

      const [{ data: svcs }, { data: revs }, { data: photos }] = await Promise.all([
        supabase.from('provider_services')
          .select('id, service:services(title, description, base_price)')
          .eq('provider_id', pp.id).eq('is_active', true).limit(12),
        supabase.from('reviews')
          .select('id, rating, review_text, created_at')
          .eq('reviewee_id', pp.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('provider_portfolio_photos')
          .select('id, url, caption')
          .eq('provider_id', pp.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(20),
      ])

      setServices((svcs ?? []) as any)
      setReviews((revs ?? []) as any)
      setPortfolioPhotos((photos ?? []) as PortfolioPhoto[])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!provider) return
    async function prefetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setPrefetchedCustomerId(user.id)
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('customer_id', user.id).eq('provider_id', provider!.user_id).is('booking_id', null).maybeSingle()
      if (existing) setPrefetchedConvId(existing.id)
    }
    prefetch()
  }, [provider])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) {
      if (e.key === 'Escape') setShowPhotoGallery(false)
      return
    }
    if (e.key === 'Escape')     setLightboxIdx(null)
    if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null ? Math.min(i + 1, portfolioPhotos.length - 1) : null)
    if (e.key === 'ArrowLeft')  setLightboxIdx(i => i !== null ? Math.max(i - 1, 0) : null)
  }, [lightboxIdx, portfolioPhotos.length])

  useEffect(() => {
    if (!showPhotoGallery) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPhotoGallery, handleKeyDown])

  useEffect(() => {
    if (loading) return
    const el = document.querySelector('main') ?? window
    const onScroll = () => {
      if (galleryRef.current) setStickyVisible(galleryRef.current.getBoundingClientRect().bottom < 64)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading])

  async function handleMessage() {
    if (!provider) return
    setMessaging(true)
    if (prefetchedConvId) { router.push(`/messages/${prefetchedConvId}`); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const customerId = prefetchedCustomerId ?? user.id
    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('customer_id', customerId).eq('provider_id', provider.user_id).is('booking_id', null).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: conv } = await supabase.from('conversations').insert({
      customer_id: customerId, provider_id: provider.user_id,
      conversation_type: 'direct', status: 'active',
    }).select('id').single()
    setMessaging(false)
    if (conv) router.push(`/messages/${conv.id}`)
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  if (!provider) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Provider not found.</p>
      <button onClick={() => router.back()} className="mt-4 text-primary hover:underline text-sm">Go back</button>
    </div>
  )

  const displayName = provider.business_name
    ?? `${titleCase(provider.first_name)} ${titleCase(provider.last_name)}`
  const initials = provider.business_name
    ? provider.business_name.charAt(0).toUpperCase()
    : `${provider.first_name?.[0] ?? ''}${provider.last_name?.[0] ?? ''}`.toUpperCase()

  const bio      = provider.bio ?? ''
  const BIO_LIMIT = 320
  const bioTruncated = bio.length > BIO_LIMIT && !bioExpanded

  const trades    = provider.trade_categories ?? (provider.trade_category ? [provider.trade_category] : [])
  const areas     = provider.service_areas ?? []
  const licenses  = provider.licenses ?? []
  const languages = provider.languages ?? []

  const headline  = trades.length > 0 ? trades.map(t => t.replace(/_/g, ' ')).join(' | ') : displayName
  const rating    = Number(provider.rating_average)
  const jobs      = provider.total_jobs_completed ?? 0
  const isTopRated = rating >= 4.7 && jobs >= 3

  const memberSince = provider.created_at
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(provider.created_at))
    : null

  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 4)

  return (
    <div className="-mx-6 -mt-6 lg:-mx-8 lg:-mt-8 pb-16">

      {/* ── Sticky nav ── */}
      <div className={`sticky top-0 z-40 bg-white border-b border-gray-100 transition-all duration-200 ${stickyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
        <div className="flex items-center justify-between px-6 lg:px-8 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          {provider.hourly_rate != null && (
            <Link
              href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors shrink-0"
            >
              Book now
            </Link>
          )}
        </div>
      </div>

      {/* ── Back button ── */}
      <div className="px-6 lg:px-8 py-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      {/* ── Photo gallery ── */}
      <div ref={galleryRef} className="px-6 lg:px-8 pb-6">
        <div className="h-[420px] overflow-hidden rounded-2xl gap-2 grid"
          style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {/* Main large photo */}
          <div className="row-span-2 overflow-hidden">
            {provider.profile_image_url ? (
              <img src={provider.profile_image_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.18] to-primary/[0.32]">
                <span className="text-9xl font-bold text-primary/20 select-none">{initials}</span>
              </div>
            )}
          </div>

          {[0, 1, 2].map((idx) => {
            const photo = portfolioPhotos[idx]
            const fallbacks = ['from-primary/[0.08] to-primary/[0.16]', 'from-gray-100 to-gray-200', 'from-primary/[0.05] to-primary/[0.12]']
            return (
              <div key={idx} className={`overflow-hidden ${photo ? 'cursor-pointer' : ''}`}
                onClick={photo ? () => { setShowPhotoGallery(true); setLightboxIdx(idx) } : undefined}>
                {photo
                  ? <img src={photo.url} alt={photo.caption ?? ''} className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                  : <div className={`h-full w-full bg-gradient-to-br ${fallbacks[idx]}`} />}
              </div>
            )
          })}

          <div className={`relative overflow-hidden ${portfolioPhotos[3] ? 'cursor-pointer' : ''}`}
            onClick={portfolioPhotos[3] ? () => { setShowPhotoGallery(true); setLightboxIdx(3) } : undefined}>
            {portfolioPhotos[3]
              ? <img src={portfolioPhotos[3].url} alt={portfolioPhotos[3].caption ?? ''} className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
              : <div className="h-full w-full bg-gradient-to-br from-gray-50 to-gray-150" />}
            <div className="absolute bottom-3 right-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowPhotoGallery(true); setLightboxIdx(null) }}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-dark shadow-md hover:shadow-lg transition-shadow ring-1 ring-gray-200"
              >
                <Grid2X2 size={12} /> Show all photos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="px-6 lg:px-8">
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden flex flex-col">

          {/* ── HEADER ── */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-start gap-5">

              {/* Avatar */}
              <div className="h-[84px] w-[84px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold overflow-hidden ring-2 ring-gray-100 shrink-0">
                {provider.profile_image_url
                  ? <img src={provider.profile_image_url} alt="" className="h-full w-full object-cover" />
                  : initials}
              </div>

              {/* Name block */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[1.375rem] font-bold text-gray-900 leading-tight">{displayName}</h1>
                  {provider.identity_verified && <BadgeCheck size={21} className="text-primary shrink-0" />}
                </div>
                {provider.business_name && (provider.first_name || provider.last_name) && (
                  <p className="text-sm text-gray-500 mt-0.5">{provider.first_name} {provider.last_name}</p>
                )}
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1.5">
                  <MapPin size={13} className="shrink-0" />
                  <span>
                    {provider.city
                      ? `${provider.city}, UK`
                      : areas.length > 0
                      ? `${areas[0]}, UK`
                      : 'Location not specified'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {isTopRated && (
                    <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800"><Crown size={10} className="text-white" /></span>
                      Top Rated
                    </span>
                  )}
                  {provider.identity_verified && (
                    <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800"><BadgeCheck size={10} className="text-white" /></span>
                      ID Verified
                    </span>
                  )}
                  {(provider.badges ?? []).map((badge: string) => (
                    <span key={badge} className="inline-flex items-center gap-1 rounded-full border-2 border-gray-800 px-3 py-0.5 text-xs font-semibold text-gray-800">{badge}</span>
                  ))}
                </div>
              </div>

              {/* Booking CTAs */}
              <div className="flex flex-col items-end gap-3 shrink-0 pt-1">
                {provider.hourly_rate != null && (
                  <p className="text-2xl font-bold text-gray-900">
                    £{provider.hourly_rate}<span className="text-base font-normal text-gray-500">/hr</span>
                  </p>
                )}
                <Link
                  href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  <CalendarCheck size={14} /> Request a booking
                </Link>
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 w-full justify-center"
                >
                  <MessageSquare size={14} /> {messaging ? 'Opening…' : 'Message'}
                </button>
                <p className="text-xs text-gray-400">You won't be charged yet</p>
              </div>
            </div>
          </div>

          {/* ── STATS STRIP ── */}
          <div className="border-t border-gray-100 px-8 py-6 flex flex-wrap items-start gap-10">
            <div className="shrink-0">
              <p className="text-2xl font-bold text-gray-900">{jobs > 0 ? jobs : '0'}</p>
              <p className="text-xs text-gray-500 mt-1">Jobs completed</p>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-gray-900">{rating > 0 ? rating.toFixed(1) : '—'}</p>
                {rating > 0 && <StarRow rating={rating} />}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rating</p>
            </div>
            {provider.total_reviews > 0 && (
              <div className="shrink-0">
                <p className="text-2xl font-bold text-gray-900">{provider.total_reviews}</p>
                <p className="text-xs text-gray-500 mt-1">Review{provider.total_reviews !== 1 ? 's' : ''}</p>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900 capitalize leading-snug">{headline}</p>
              {memberSince && <p className="text-xs text-gray-500 mt-1">Member since {memberSince}</p>}
            </div>
          </div>

          {/* ── BODY ── */}
          <div className="border-t border-gray-100 flex flex-col lg:flex-row flex-1">

            {/* ── LEFT SIDEBAR ── */}
            <aside className="lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-100 px-7 py-7 space-y-7">

              {provider.avg_response_hours != null && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Avg. response</p>
                  <p className="text-sm text-gray-600">{provider.avg_response_hours} hrs</p>
                </div>
              )}

              {provider.phone && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Phone</p>
                  <a href={`tel:${provider.phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Phone size={13} /> {provider.phone}
                  </a>
                </div>
              )}

              {provider.website && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Website</p>
                  <a href={provider.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline max-w-full">
                    <Globe size={13} className="shrink-0" />
                    <span className="truncate">{provider.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Verifications</p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    ID:{' '}
                    {provider.identity_verified
                      ? <span className="text-primary font-medium inline-flex items-center gap-0.5">Verified <BadgeCheck size={13} /></span>
                      : <span className="text-gray-400">Not verified</span>}
                  </p>
                  {provider.verification_status === 'verified' && (
                    <p className="text-sm text-gray-600 inline-flex items-center gap-1">
                      <Shield size={13} className="text-green-600 shrink-0" />
                      Documents verified
                    </p>
                  )}
                </div>
              </div>

              {licenses.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Licenses</p>
                  <div className="space-y-1.5">
                    {licenses.map((item, i) => {
                      const [name, level] = item.split(':').map(s => s.trim())
                      return level ? (
                        <p key={i} className="text-sm text-gray-600">{name}: <span className="text-primary font-medium">{level}</span></p>
                      ) : (
                        <p key={i} className="text-sm text-gray-600">{item}</p>
                      )
                    })}
                  </div>
                </div>
              )}

              {languages.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Languages</p>
                  <div className="space-y-1.5">
                    {languages.map((item, i) => {
                      const [name, level] = item.split(':').map(s => s.trim())
                      return level ? (
                        <p key={i} className="text-sm text-gray-600">{name}: <span className="text-primary font-medium">{level}</span></p>
                      ) : (
                        <p key={i} className="text-sm text-gray-600">{item}</p>
                      )
                    })}
                  </div>
                </div>
              )}

              {areas.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Service areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {areas.map((area: string) => (
                      <span key={area} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{area}</span>
                    ))}
                  </div>
                </div>
              )}

              {memberSince && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={13} className="shrink-0" />
                  Member since {memberSince}
                </div>
              )}
            </aside>

            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 min-w-0 px-8 py-7 space-y-8">

              {/* Bio */}
              {bio && (
                <div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {bioTruncated ? bio.slice(0, BIO_LIMIT) + '…' : bio}
                  </p>
                  {bio.length > BIO_LIMIT && (
                    <button onClick={() => setBioExpanded(v => !v)}
                      className="mt-1 text-sm text-primary underline hover:no-underline">
                      {bioExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Work history */}
              <div className={bio ? 'border-t border-gray-100 pt-7' : ''}>
                <h3 className="text-base font-bold text-gray-900 mb-4">Work history</h3>

                {trades.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Trades &amp; services</p>
                    <div className="flex flex-wrap gap-2">
                      {trades.map((t: string) => (
                        <span key={t} className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 capitalize">
                          {t.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {services.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Services offered</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {services.map(sv => (
                        <div key={sv.id} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-1.5">
                          <p className="text-sm font-semibold text-gray-900">{sv.service?.title}</p>
                          {sv.service?.description && (
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{sv.service.description}</p>
                          )}
                          {sv.service?.base_price != null && (
                            <p className="text-sm font-bold text-gray-900">£{(sv.service.base_price / 100).toFixed(2)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {reviews.length > 0 ? (
                  <div className="border-t border-gray-100 pt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <StarRow rating={rating} />
                      <p className="text-sm font-semibold text-gray-800">
                        {rating.toFixed(1)} · {provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="space-y-5">
                      {displayedReviews.map(rv => (
                        <div key={rv.id} className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">C</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <StarRow rating={rv.rating} size={11} />
                              <span className="text-xs text-gray-400 shrink-0">{relativeDate(rv.created_at)}</span>
                            </div>
                            {rv.review_text && (
                              <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                                {rv.review_text.length > 200 ? rv.review_text.slice(0, 200) + '…' : rv.review_text}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {reviews.length > 4 && (
                      <button onClick={() => setShowAllReviews(v => !v)}
                        className="mt-4 text-sm text-primary hover:underline">
                        {showAllReviews ? 'Show fewer reviews' : `View all ${reviews.length} reviews →`}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-5">No reviews yet.</p>
                )}
              </div>

              {/* Portfolio */}
              {portfolioPhotos.length > 0 && (
                <div className="border-t border-gray-100 pt-7">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Portfolio</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {portfolioPhotos.map((photo, idx) => (
                      <div key={photo.id}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 cursor-pointer"
                        onClick={() => { setShowPhotoGallery(true); setLightboxIdx(idx) }}>
                        <img src={photo.url} alt={photo.caption ?? ''}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                        {photo.caption && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-white line-clamp-2">{photo.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </main>
          </div>
        </div>
      </div>

      {/* ── Photo gallery modal ── */}
      {showPhotoGallery && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
            <p className="text-sm font-semibold text-dark">
              {portfolioPhotos.length > 0
                ? `${portfolioPhotos.length} photo${portfolioPhotos.length !== 1 ? 's' : ''} · ${displayName}`
                : `${displayName} · Portfolio`}
            </p>
            <button onClick={() => { setShowPhotoGallery(false); setLightboxIdx(null) }}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>

          {portfolioPhotos.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <Grid2X2 size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No photos yet</p>
                <p className="text-xs text-gray-400">This provider hasn't uploaded portfolio photos.</p>
              </div>
            </div>
          ) : lightboxIdx !== null ? (
            <div className="flex flex-1 flex-col bg-black overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 shrink-0">
                <button onClick={() => setLightboxIdx(null)}
                  className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors">
                  <ChevronLeft size={16} /> All photos
                </button>
                <p className="text-sm text-white/60">{lightboxIdx + 1} / {portfolioPhotos.length}</p>
                <button onClick={() => { setShowPhotoGallery(false); setLightboxIdx(null) }}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                  <X size={18} className="text-white" />
                </button>
              </div>
              <div className="relative flex flex-1 items-center justify-center px-4 overflow-hidden">
                <img key={lightboxIdx} src={portfolioPhotos[lightboxIdx].url} alt={portfolioPhotos[lightboxIdx].caption ?? ''}
                  className="max-h-full max-w-full object-contain select-none" />
                {lightboxIdx > 0 && (
                  <button onClick={() => setLightboxIdx(i => i !== null ? i - 1 : null)}
                    className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <ChevronLeft size={20} className="text-white" />
                  </button>
                )}
                {lightboxIdx < portfolioPhotos.length - 1 && (
                  <button onClick={() => setLightboxIdx(i => i !== null ? i + 1 : null)}
                    className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <ChevronRight size={20} className="text-white" />
                  </button>
                )}
              </div>
              {portfolioPhotos[lightboxIdx].caption && (
                <div className="shrink-0 px-6 py-4 text-center">
                  <p className="text-sm text-white/70">{portfolioPhotos[lightboxIdx].caption}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 p-1">
                {portfolioPhotos.map((photo, idx) => (
                  <button key={photo.id} onClick={() => setLightboxIdx(idx)}
                    className="group relative aspect-square overflow-hidden bg-gray-100 focus:outline-none">
                    <img src={photo.url} alt={photo.caption ?? ''}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    {photo.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white line-clamp-2">{photo.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
