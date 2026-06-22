'use client'
import { Suspense, useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency, titleCase } from '@/lib/utils'
import {
  Star, BadgeCheck, MapPin, Clock, MessageSquare, CalendarCheck,
  Shield, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react'
import { CATEGORY_META } from '@/lib/service-questions'

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
  reviewer: { first_name: string; last_name: string } | null
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

  const [provider, setProvider]   = useState<ProviderProfile | null>(null)
  const [services, setServices]   = useState<ProviderService[]>([])
  const [reviews, setReviews]     = useState<Review[]>([])
  const [loading, setLoading]     = useState(true)
  const [messaging, setMessaging] = useState(false)
  const [bioExpanded, setBioExpanded]         = useState(false)
  const [showAllReviews, setShowAllReviews]   = useState(false)
  const [stickyVisible, setStickyVisible]     = useState(false)
  const [activeNav, setActiveNav]             = useState('about')

  const galleryRef  = useRef<HTMLDivElement>(null)
  const aboutRef    = useRef<HTMLDivElement>(null)
  const servicesRef = useRef<HTMLDivElement>(null)
  const reviewsRef  = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: pp } = await supabase
        .from('provider_profiles')
        .select('id, user_id, first_name, last_name, business_name, bio, trade_category, hourly_rate, rating_average, total_reviews, verification_status, identity_verified, service_areas, profile_image_url, created_at')
        .eq('user_id', id as string)
        .maybeSingle()

      if (!pp) { setLoading(false); return }
      setProvider(pp)

      const [{ data: svcs }, { data: revs }] = await Promise.all([
        supabase.from('provider_services')
          .select('id, service:services(title, description, base_price)')
          .eq('provider_id', pp.id).eq('is_active', true).limit(12),
        supabase.from('reviews')
          .select('id, rating, review_text, created_at, reviewer:customer_profiles(first_name, last_name)')
          .eq('reviewee_id', pp.id).order('created_at', { ascending: false }).limit(20),
      ])

      setServices((svcs ?? []) as any)
      setReviews((revs ?? []) as any)
      setLoading(false)
    }
    load()
  }, [id])

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
    setMessaging(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!cp || !provider) { setMessaging(false); return }

    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('customer_id', cp.id).eq('provider_id', provider.id).is('booking_id', null).maybeSingle()

    if (existing) { router.push(`/messages/${existing.id}`); return }

    const { data: conv } = await supabase.from('conversations').insert({
      customer_id: cp.id, provider_id: provider.id,
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
  const meta       = provider.trade_category ? CATEGORY_META[provider.trade_category] : null
  const memberSince = provider.created_at
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(provider.created_at))
    : null

  const BIO_LIMIT   = 320
  const bioText     = provider.bio ?? ''
  const bioTruncated = bioText.length > BIO_LIMIT && !bioExpanded
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 6)

  const ratingCounts = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }))

  const highlights = [
    provider.identity_verified && {
      icon: <BadgeCheck size={24} className="text-primary" />,
      title: 'Identity verified',
      desc: 'This provider has confirmed their identity with Servios.',
    },
    provider.verification_status === 'verified' && {
      icon: <Shield size={24} className="text-primary" />,
      title: 'Documents verified',
      desc: 'Qualifications and insurance documents have been reviewed.',
    },
    {
      icon: <Zap size={24} className="text-primary" />,
      title: 'Fast response',
      desc: 'Typically responds within an hour of a message or booking request.',
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
                {provider.rating_average > 0 && (
                  <p className="text-xs text-muted flex items-center gap-1 justify-end">
                    <Star size={10} className="fill-dark stroke-dark" />
                    {provider.rating_average.toFixed(2)} · {provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}
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
        <div
          className="h-[420px] overflow-hidden rounded-2xl gap-2 grid"
          style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}
        >
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

          {/* Smaller slots */}
          <div className="overflow-hidden bg-gradient-to-br from-primary/[0.08] to-primary/[0.16]" />
          <div className="overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200" />
          <div className="overflow-hidden bg-gradient-to-br from-primary/[0.05] to-primary/[0.12]" />

          {/* Bottom-right: "Show all" button */}
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-150">
            <div className="absolute bottom-3 right-3">
              <button className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-dark shadow-md hover:shadow-lg transition-shadow ring-1 ring-gray-200">
                <span className="grid grid-cols-2 gap-0.5 w-3 h-3">
                  <span className="bg-dark rounded-[1px]" />
                  <span className="bg-dark rounded-[1px]" />
                  <span className="bg-dark rounded-[1px]" />
                  <span className="bg-dark rounded-[1px]" />
                </span>
                Show all photos
              </button>
            </div>
          </div>
        </div>
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
              {provider.rating_average > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-semibold text-dark">
                    <Star size={12} className="fill-dark stroke-dark" />
                    {provider.rating_average.toFixed(2)}
                  </span>
                  <span className="text-muted">({provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''})</span>
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
                    {provider.rating_average.toFixed(2)} · {provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}
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
                    const reviewerName = rv.reviewer
                      ? `${titleCase(rv.reviewer.first_name)} ${titleCase(rv.reviewer.last_name)}`
                      : 'Customer'
                    const reviewerInitial = rv.reviewer?.first_name?.[0]?.toUpperCase() ?? 'C'
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
                <p className="text-sm text-muted mb-5">{provider.service_areas.join(' · ')}</p>
                <div className="h-52 overflow-hidden rounded-2xl bg-gray-100 flex items-center justify-center ring-1 ring-gray-200">
                  <div className="text-center space-y-2">
                    <MapPin size={24} className="text-muted mx-auto" />
                    <p className="text-sm text-muted">Map view coming soon</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Service areas not specified.</p>
            )}
          </div>
        </div>

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
                {provider.rating_average > 0 && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm">
                    <Star size={13} className="fill-dark stroke-dark" />
                    <span className="font-semibold text-dark">{provider.rating_average.toFixed(2)}</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted underline cursor-pointer" onClick={() => scrollToSection(reviewsRef, 'reviews')}>
                      {provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}
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

            <p className="text-center text-xs text-muted">You won't be charged yet</p>

            {/* Trust signals */}
            {(provider.identity_verified || provider.verification_status === 'verified' || (provider.service_areas?.length ?? 0) > 0) && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                {provider.identity_verified && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <BadgeCheck size={16} className="text-primary shrink-0" />
                    <span>Identity verified</span>
                  </div>
                )}
                {provider.verification_status === 'verified' && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield size={16} className="text-green-600 shrink-0" />
                    <span>Documents verified</span>
                  </div>
                )}
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
