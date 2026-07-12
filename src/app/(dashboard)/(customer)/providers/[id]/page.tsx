'use client'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency, titleCase } from '@/lib/utils'
import {
  Star, BadgeCheck, MapPin, Clock, MessageSquare, CalendarCheck,
  Shield, ChevronLeft, ChevronRight, Zap, X, Grid2X2,
} from 'lucide-react'
import { CATEGORY_META } from '@/lib/service-questions'

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
  hourly_rate: number | null
  rating_average: number
  total_reviews: number
  verification_status: string
  identity_verified: boolean
  service_areas: string[] | null
  profile_image_url: string | null
  created_at: string
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

export default function CustomerProviderProfilePage() {
  return <Suspense fallback={null}><CustomerProviderProfileInner /></Suspense>
}

function CustomerProviderProfileInner() {
  const { id }       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const context      = searchParams.get('context') ?? ''

  const [provider, setProvider]         = useState<ProviderProfile | null>(null)
  const [services, setServices]         = useState<ProviderService[]>([])
  const [reviews, setReviews]           = useState<Review[]>([])
  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([])
  const [loading, setLoading]           = useState(true)
  const [messaging, setMessaging]       = useState(false)
  const [prefetchedConvId, setPrefetchedConvId]     = useState<string | null>(null)
  const [prefetchedCustomerId, setPrefetchedCustomerId] = useState<string | null>(null)
  const [bioExpanded, setBioExpanded]         = useState(false)
  const [showAllReviews, setShowAllReviews]   = useState(false)
  const [stickyVisible, setStickyVisible]     = useState(false)
  const [activeNav, setActiveNav]             = useState('about')
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [lightboxIdx, setLightboxIdx]           = useState<number | null>(null)
  const [verifiedDocs, setVerifiedDocs]         = useState<{ document_type: string; title: string | null }[]>([])

  const galleryRef  = useRef<HTMLDivElement>(null)
  const aboutRef    = useRef<HTMLDivElement>(null)
  const servicesRef = useRef<HTMLDivElement>(null)
  const reviewsRef  = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: pp } = await supabase
        .from('provider_profiles')
        .select('id, user_id, first_name, last_name, business_name, bio, trade_category, hourly_rate, rating_average, total_reviews, verification_status, identity_verified, service_areas, max_travel_distance, profile_image_url, avg_response_hours, created_at')
        .eq('user_id', id as string)
        .maybeSingle()

      if (!pp) { setLoading(false); return }
      setProvider(pp)

      const [{ data: svcs }, { data: revs }, { data: photos }, { data: docs }] = await Promise.all([
        supabase.from('provider_services')
          .select('id, service:services(title, description, base_price)')
          .eq('provider_id', pp.id).eq('is_active', true).limit(12),
        supabase.from('reviews')
          .select('id, rating, review_text, created_at')
          .eq('reviewee_id', pp.user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('provider_portfolio_photos')
          .select('id, url, caption')
          .eq('provider_id', pp.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(20),
        supabase.from('provider_documents')
          .select('document_type, title')
          .eq('provider_id', pp.id)
          .in('status', ['verified', 'approved']),
      ])

      setServices((svcs ?? []) as any)
      setReviews((revs ?? []) as any)
      setVerifiedDocs((docs ?? []) as any)
      setPortfolioPhotos((photos ?? []) as PortfolioPhoto[])
      setLoading(false)
    }
    load()
  }, [id])

  // Pre-fetch customer profile + any existing conversation so Message navigates instantly
  useEffect(() => {
    if (!provider) return
    async function prefetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setPrefetchedCustomerId(user.id)
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('customer_id', user.id).eq('provider_id', provider.user_id).is('booking_id', null).maybeSingle()
      if (existing) setPrefetchedConvId(existing.id)
    }
    prefetch()
  }, [provider])

  // Keyboard nav for lightbox
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) {
      if (e.key === 'Escape') setShowPhotoGallery(false)
      return
    }
    if (e.key === 'Escape')      setLightboxIdx(null)
    if (e.key === 'ArrowRight')  setLightboxIdx(i => i !== null ? Math.min(i + 1, portfolioPhotos.length - 1) : null)
    if (e.key === 'ArrowLeft')   setLightboxIdx(i => i !== null ? Math.max(i - 1, 0) : null)
  }, [lightboxIdx, portfolioPhotos.length])

  useEffect(() => {
    if (!showPhotoGallery) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showPhotoGallery, handleKeyDown])

  // Sticky nav detection — uses getBoundingClientRect (viewport-relative), works in any scroll container
  useEffect(() => {
    if (loading) return
    const main = document.querySelector('main')
    const el   = main ?? window
    const onScroll = () => {
      if (galleryRef.current) {
        setStickyVisible(galleryRef.current.getBoundingClientRect().bottom < 64)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loading])

  function scrollToSection(ref: React.RefObject<HTMLDivElement>, key: string) {
    setActiveNav(key)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleMessage() {
    if (!provider) return
    setMessaging(true)

    // Use pre-fetched conversation if available — near-instant navigation
    if (prefetchedConvId) {
      router.push(`/messages/${prefetchedConvId}`)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const customerId = prefetchedCustomerId ?? user.id

    // Check again in case pre-fetch hadn't finished
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

  const displayName = provider.business_name?.trim()
    || `${titleCase(provider.first_name)} ${titleCase(provider.last_name)}`
  const initials = provider.business_name
    ? provider.business_name.charAt(0).toUpperCase()
    : `${provider.first_name?.[0] ?? ''}${provider.last_name?.[0] ?? ''}`.toUpperCase()
  const meta       = provider.trade_category ? CATEGORY_META[provider.trade_category] : null
  const memberSince = provider.created_at
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(provider.created_at))
    : null

  const BIO_LIMIT   = 320
  const bioText     = provider.bio ?? ''
  const bioTruncated = bioText.length > BIO_LIMIT && !bioExpanded
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 6)

  // Single source of truth for rating display: only show a rating when we can
  // actually show the reviews behind it, so the header never contradicts the
  // Reviews section (e.g. stale aggregates saying "2 reviews" over an empty list).
  const hasReviews   = reviews.length > 0
  const ratingValue  = hasReviews ? provider.rating_average : 0
  const reviewCount  = hasReviews ? Math.max(provider.total_reviews, reviews.length) : 0
  const showRating   = hasReviews && ratingValue > 0

  const ratingCounts = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }))

  // ID documents are represented by the "Identity verified" badge, not shown
  // as a public credential of their own.
  const publicDocs = verifiedDocs.filter(d => d.document_type !== 'id')

  const highlights = [
    provider.identity_verified && {
      icon: <BadgeCheck size={24} className="text-primary" />,
      title: 'Identity verified',
      desc: 'This provider has confirmed their identity with Servios.',
    },
    ...(publicDocs.length > 0
      ? publicDocs.map(doc => ({
          icon: <Shield size={24} className="text-primary" />,
          title: doc.title ?? doc.document_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          desc: 'This document has been reviewed and verified by Servios.',
        }))
      : provider.verification_status === 'verified'
        ? [{
            icon: <Shield size={24} className="text-primary" />,
            title: 'Documents verified',
            desc: 'Qualifications and insurance documents have been reviewed.',
          }]
        : []),
    provider.avg_response_hours != null && {
      icon: <Zap size={24} className="text-primary" />,
      title: `Avg. response ${provider.avg_response_hours} hr${provider.avg_response_hours !== 1 ? 's' : ''}`,
      desc: `Typically replies to messages and booking requests within ${provider.avg_response_hours} hour${provider.avg_response_hours !== 1 ? 's' : ''}.`,
    },
    memberSince && {
      icon: <Clock size={24} className="text-primary" />,
      title: `Member since ${memberSince}`,
      desc: 'A trusted and established member of the Servios community.',
    },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; desc: string }[]

  const NAV_SECTIONS = [
    { key: 'about',    label: 'About',    ref: aboutRef },
    { key: 'services', label: 'Services', ref: servicesRef },
    { key: 'reviews',  label: 'Reviews',  ref: reviewsRef },
    { key: 'location', label: 'Location', ref: locationRef },
  ]

  return (
    // Break out of the layout's p-6/p-8 padding so gallery goes full-width
    <div className="-mx-6 -mt-6 lg:-mx-8 lg:-mt-8 pb-16">

      {/* ── Sticky nav (appears after gallery scrolls past) ── */}
      <div className={`sticky top-0 z-40 bg-white border-b border-gray-100 transition-all duration-200 ${stickyVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
        <div className="flex items-center justify-between px-6 lg:px-8 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          <nav className="hidden sm:flex items-center gap-6">
            {NAV_SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => scrollToSection(s.ref, s.key)}
                className={`text-sm font-medium pb-0.5 transition-colors border-b-2 ${
                  activeNav === s.key ? 'border-dark text-dark' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          {provider.hourly_rate != null && (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-dark">£{provider.hourly_rate}/hr</p>
                {showRating && (
                  <p className="text-xs text-muted flex items-center gap-1 justify-end">
                    <Star size={10} className="fill-dark stroke-dark" />
                    {ratingValue.toFixed(2)} · {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <Link
                href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
              >
                Book now
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Back button (before gallery, not sticky) ── */}
      <div className="px-6 lg:px-8 py-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
      </div>

      {/* ── Photo gallery ── */}
      <div ref={galleryRef} id="photos" className="px-6 lg:px-8 pb-6">
        {portfolioPhotos.length === 0 ? (
          /* No portfolio photos — compact hero with a single empty-state panel */
          <div className="h-[280px] overflow-hidden rounded-2xl gap-2 grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="overflow-hidden">
              {provider.profile_image_url ? (
                <img src={provider.profile_image_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 text-3xl font-bold text-gray-400 shadow-sm select-none">{initials}</div>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center justify-center gap-2 bg-gray-50 text-center px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
                <Grid2X2 size={18} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-dark">No photos yet</p>
              <p className="text-xs text-muted leading-relaxed">
                This provider hasn't added work photos yet — check their reviews and verifications below.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="h-[420px] overflow-hidden rounded-2xl gap-2 grid"
            style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}
          >
            {/* Main large photo */}
            <div className="row-span-2 overflow-hidden">
              {provider.profile_image_url ? (
                <img src={provider.profile_image_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white ring-1 ring-gray-200 text-4xl font-bold text-gray-400 shadow-sm select-none">{initials}</div>
                </div>
              )}
            </div>

            {/* Smaller slots — filled with portfolio photos if available */}
            {[0, 1, 2].map((idx) => {
              const photo = portfolioPhotos[idx]
              return (
                <div
                  key={idx}
                  className={`overflow-hidden ${photo ? 'cursor-pointer' : ''}`}
                  onClick={photo ? () => { setShowPhotoGallery(true); setLightboxIdx(idx) } : undefined}
                >
                  {photo ? (
                    <img src={photo.url} alt={photo.caption ?? ''} className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="h-full w-full bg-gray-50" />
                  )}
                </div>
              )
            })}

            {/* Bottom-right: "Show all" button */}
            <div
              className={`relative overflow-hidden ${portfolioPhotos[3] ? 'cursor-pointer' : ''}`}
              onClick={portfolioPhotos[3] ? () => { setShowPhotoGallery(true); setLightboxIdx(3) } : undefined}
            >
              {portfolioPhotos[3] ? (
                <img src={portfolioPhotos[3].url} alt={portfolioPhotos[3].caption ?? ''} className="h-full w-full object-cover hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="h-full w-full bg-gray-50" />
              )}
              <div className="absolute bottom-3 right-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPhotoGallery(true); setLightboxIdx(null) }}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-dark shadow-md hover:shadow-lg transition-shadow ring-1 ring-gray-200"
                >
                  <Grid2X2 size={12} />
                  Show all photos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="px-6 lg:px-8 flex flex-col lg:flex-row gap-14 items-start">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0">

          {/* Title block */}
          <div ref={aboutRef} id="about" className="scroll-mt-16">
            <h1 className="text-2xl font-bold text-dark">{displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {meta && <span className="capitalize">{meta.label}</span>}
              {provider.service_areas && provider.service_areas.length > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    {provider.service_areas.slice(0, 2).join(', ')}
                  </span>
                </>
              )}
              {showRating && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-semibold text-dark">
                    <Star size={12} className="fill-dark stroke-dark" />
                    {ratingValue.toFixed(2)}
                  </span>
                  <span className="text-muted">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
                </>
              )}
              {provider.identity_verified && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <BadgeCheck size={12} /> Verified
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="my-7 border-t border-gray-100" />

          {/* Provider card */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-gray-100">
              {provider.profile_image_url ? (
                <img src={provider.profile_image_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.10] to-primary/[0.22]">
                  <span className="text-xl font-bold text-primary/30">{initials}</span>
                </div>
              )}
              {provider.identity_verified && (
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-2 ring-white">
                  <BadgeCheck size={11} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-dark">{displayName}</p>
              {memberSince && (
                <p className="text-sm text-muted">Member since {memberSince}</p>
              )}
              <Link href={`/providers/${provider.user_id}/profile`}
                className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                View full profile →
              </Link>
            </div>
          </div>

          <div className="my-7 border-t border-gray-100" />

          {/* Highlights */}
          <div className="space-y-6">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-5">
                <div className="shrink-0 mt-0.5">{h.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-dark">{h.title}</p>
                  <p className="text-sm text-muted mt-0.5 leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="my-7 border-t border-gray-100" />

          {/* About / Bio */}
          {bioText ? (
            <>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-gray-700">
                  {bioTruncated ? bioText.slice(0, BIO_LIMIT) + '…' : bioText}
                </p>
                {bioText.length > BIO_LIMIT && (
                  <button
                    onClick={() => setBioExpanded(v => !v)}
                    className="flex items-center gap-1 text-sm font-semibold text-dark underline hover:text-primary transition-colors"
                  >
                    {bioExpanded ? 'Show less' : 'Show more'}
                    <ChevronRight size={14} className={`transition-transform ${bioExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
              <div className="my-7 border-t border-gray-100" />
            </>
          ) : null}

          {/* Services offered */}
          {services.length > 0 && (
            <>
              <div ref={servicesRef} id="services" className="scroll-mt-16">
                <h2 className="text-lg font-bold text-dark mb-5">Services offered</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {services.map(sv => (
                    <div key={sv.id} className="rounded-2xl border border-gray-100 bg-white p-5 space-y-2 hover:border-gray-200 transition-colors">
                      <p className="text-sm font-semibold text-dark">{sv.service?.title}</p>
                      {sv.service?.description && (
                        <p className="text-xs text-muted leading-relaxed line-clamp-2">{sv.service.description}</p>
                      )}
                      {sv.service?.base_price != null && (
                        <p className="text-sm font-bold text-dark">{formatCurrency(sv.service.base_price / 100)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="my-7 border-t border-gray-100" />
            </>
          )}

          {/* Reviews */}
          <div ref={reviewsRef} id="reviews" className="scroll-mt-16">
            {reviews.length > 0 ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-2 mb-6">
                  <Star size={20} className="fill-dark stroke-dark" />
                  <h2 className="text-lg font-bold text-dark">
                    {ratingValue.toFixed(2)} · {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                  </h2>
                </div>

                {/* Rating breakdown — 2 columns */}
                <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ratingCounts.map(({ star, count }) => {
                    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="w-5 shrink-0 text-right text-xs text-muted">{star}</span>
                        <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-dark transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-7 shrink-0 text-xs text-muted">{pct}%</span>
                      </div>
                    )
                  })}
                </div>

                {/* Review cards — 2 column */}
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                  {displayedReviews.map(rv => {
                    const reviewerName = 'Customer'
                    const reviewerInitial = 'C'
                    return (
                      <div key={rv.id} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {reviewerInitial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-dark">{reviewerName}</p>
                            <p className="text-xs text-muted">{formatDate(rv.created_at)}</p>
                          </div>
                        </div>
                        <StarRow rating={rv.rating} size={12} />
                        {rv.review_text && (
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-5">{rv.review_text}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {reviews.length > 6 && (
                  <button
                    onClick={() => setShowAllReviews(v => !v)}
                    className="mt-7 rounded-xl border border-dark px-6 py-3 text-sm font-semibold text-dark hover:bg-gray-50 transition-colors"
                  >
                    {showAllReviews ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
                  </button>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-dark mb-2">Reviews</h2>
                <p className="text-sm text-muted">No reviews yet — be the first to book!</p>
              </>
            )}
          </div>

          <div className="my-7 border-t border-gray-100" />

          {/* Service areas */}
          <div ref={locationRef} id="location" className="scroll-mt-16">
            <h2 className="text-lg font-bold text-dark mb-2">Where they work</h2>
            {provider.service_areas && provider.service_areas.length > 0 ? (
              <>
                <p className="text-sm text-muted mb-5">
                  {provider.service_areas.join(' · ')}
                  {(provider as any).max_travel_distance != null && (
                    <span> · Travels up to {(provider as any).max_travel_distance} miles</span>
                  )}
                </p>
                <div className="h-52 overflow-hidden rounded-2xl bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                  <div className="text-center space-y-2">
                    <MapPin size={24} className="text-muted mx-auto" />
                    <p className="text-sm text-muted">Map view coming soon</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                Message {displayName} to confirm they cover your area — most providers travel across Greater London.
              </p>
            )}
          </div>
        </div>

        {/* ── Photo gallery modal ── */}
        {showPhotoGallery && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
              <p className="text-sm font-semibold text-dark">
                {portfolioPhotos.length > 0
                  ? `${portfolioPhotos.length} photo${portfolioPhotos.length !== 1 ? 's' : ''} · ${displayName}`
                  : `${displayName} · Portfolio`}
              </p>
              <button
                onClick={() => { setShowPhotoGallery(false); setLightboxIdx(null) }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {portfolioPhotos.length === 0 ? (
              /* Empty state */
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                    <Grid2X2 size={24} className="text-muted" />
                  </div>
                  <p className="text-sm font-semibold text-dark">No photos yet</p>
                  <p className="text-xs text-muted">This provider hasn't uploaded portfolio photos.</p>
                </div>
              </div>
            ) : lightboxIdx !== null ? (
              /* Lightbox view */
              <div className="flex flex-1 flex-col bg-black overflow-hidden">
                {/* Lightbox nav bar */}
                <div className="flex items-center justify-between px-6 py-3 shrink-0">
                  <button
                    onClick={() => setLightboxIdx(null)}
                    className="flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                  >
                    <ChevronLeft size={16} /> All photos
                  </button>
                  <p className="text-sm text-white/60">{lightboxIdx + 1} / {portfolioPhotos.length}</p>
                  <button
                    onClick={() => { setShowPhotoGallery(false); setLightboxIdx(null) }}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={18} className="text-white" />
                  </button>
                </div>

                {/* Photo */}
                <div className="relative flex flex-1 items-center justify-center px-4 overflow-hidden">
                  <img
                    key={lightboxIdx}
                    src={portfolioPhotos[lightboxIdx].url}
                    alt={portfolioPhotos[lightboxIdx].caption ?? ''}
                    className="max-h-full max-w-full object-contain select-none"
                  />

                  {/* Prev */}
                  {lightboxIdx > 0 && (
                    <button
                      onClick={() => setLightboxIdx(i => i !== null ? i - 1 : null)}
                      className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <ChevronLeft size={20} className="text-white" />
                    </button>
                  )}
                  {/* Next */}
                  {lightboxIdx < portfolioPhotos.length - 1 && (
                    <button
                      onClick={() => setLightboxIdx(i => i !== null ? i + 1 : null)}
                      className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <ChevronRight size={20} className="text-white" />
                    </button>
                  )}
                </div>

                {/* Caption */}
                {portfolioPhotos[lightboxIdx].caption && (
                  <div className="shrink-0 px-6 py-4 text-center">
                    <p className="text-sm text-white/70">{portfolioPhotos[lightboxIdx].caption}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Grid view */
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3 p-1">
                  {portfolioPhotos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      onClick={() => setLightboxIdx(idx)}
                      className="group relative aspect-square overflow-hidden bg-gray-100 focus:outline-none"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption ?? ''}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
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

        {/* ── Right: sticky booking sidebar ── */}
        <div className="w-full lg:w-[360px] shrink-0 lg:sticky lg:top-20">
          <div className="rounded-2xl border border-gray-200 p-6 shadow-xl bg-white space-y-5">

            {/* Rate + rating */}
            {provider.hourly_rate != null && (
              <div>
                <p className="text-2xl font-bold text-dark">
                  £{provider.hourly_rate}
                  <span className="text-base font-normal text-muted"> / hr</span>
                </p>
                {showRating && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm">
                    <Star size={13} className="fill-dark stroke-dark" />
                    <span className="font-semibold text-dark">{ratingValue.toFixed(2)}</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted underline cursor-pointer" onClick={() => scrollToSection(reviewsRef, 'reviews')}>
                      {reviewCount} review{reviewCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="space-y-3">
              <Link
                href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
              >
                <CalendarCheck size={15} /> Request a booking
              </Link>
              <button
                onClick={handleMessage}
                disabled={messaging}
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-200 py-3.5 text-sm font-semibold text-dark hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <MessageSquare size={15} /> {messaging ? 'Opening…' : 'Message'}
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs text-muted">You won't be charged yet</p>
              <details className="group">
                <summary className="cursor-pointer list-none text-xs font-medium text-primary hover:underline">
                  How payment works
                </summary>
                <div className="mt-2 rounded-xl bg-gray-50 px-3.5 py-3 text-left text-xs text-gray-600 leading-relaxed">
                  Your payment is held securely by Servios when you book. The provider is
                  only paid after the job is marked complete — if anything goes wrong,
                  you're covered by our resolution process.
                </div>
              </details>
            </div>

            {/* Trust signals */}
            {(provider.identity_verified || provider.verification_status === 'verified' || (provider.service_areas?.length ?? 0) > 0) && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                {provider.identity_verified && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <BadgeCheck size={16} className="text-primary shrink-0" />
                    <span>Identity verified</span>
                  </div>
                )}
                {publicDocs.length > 0 ? (
                  publicDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-600">
                      <Shield size={16} className="text-primary shrink-0" />
                      <span>
                        {(doc.title ?? doc.document_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))} verified
                      </span>
                    </div>
                  ))
                ) : provider.verification_status === 'verified' ? (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield size={16} className="text-primary shrink-0" />
                    <span>Documents verified</span>
                  </div>
                ) : null}
                {provider.service_areas && provider.service_areas.length > 0 && (
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <MapPin size={16} className="text-muted shrink-0 mt-0.5" />
                    <span>Serves {provider.service_areas.join(', ')}</span>
                  </div>
                )}
                {memberSince && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock size={16} className="text-muted shrink-0" />
                    <span>Member since {memberSince}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
