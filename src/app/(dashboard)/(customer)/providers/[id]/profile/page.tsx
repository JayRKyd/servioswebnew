'use client'
import { Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { titleCase } from '@/lib/utils'
import {
  Star, BadgeCheck, MapPin, Clock, MessageSquare, CalendarCheck,
  Shield, ChevronLeft, ChevronRight, X, Crown, Phone, Globe,
  ImageIcon, Plus,
} from 'lucide-react'

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size}
          className={n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
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

function UKLocalTime() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => setTime(new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London',
    }).format(new Date()))
    fmt()
    const id = setInterval(fmt, 60_000)
    return () => clearInterval(id)
  }, [])
  return <>{time}</>
}

export default function CustomerProviderFullProfilePage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}

function Inner() {
  const { id }       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const context      = searchParams.get('context') ?? ''

  const [profile, setProfile]             = useState<any>(null)
  const [latestReview, setLatestReview]   = useState<any>(null)
  const [allReviews, setAllReviews]       = useState<any[]>([])
  const [portfolioPhotos, setPortfolioPhotos] = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [messaging, setMessaging]         = useState(false)
  const [prefetchedConvId, setPrefetchedConvId]         = useState<string | null>(null)
  const [prefetchedCustomerId, setPrefetchedCustomerId] = useState<string | null>(null)
  const [bioExpanded, setBioExpanded]     = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('provider_profiles').select('*').eq('user_id', id as string).maybeSingle(),
      supabase.from('reviews').select('*').eq('reviewee_id', id as string)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('reviews').select('*').eq('reviewee_id', id as string)
        .order('created_at', { ascending: false }).limit(20),
    ]).then(([{ data: p }, { data: r }, { data: revs }]) => {
      setProfile(p)
      setLatestReview(r)
      setAllReviews(revs ?? [])
      setLoading(false)
      if (p?.id) {
        supabase
          .from('provider_portfolio_photos')
          .select('*')
          .eq('provider_id', p.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .then(({ data }) => setPortfolioPhotos(data ?? []))
      }
    })
  }, [id])

  useEffect(() => {
    if (!profile) return
    async function prefetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setPrefetchedCustomerId(user.id)
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('customer_id', user.id).eq('provider_id', profile.user_id).is('booking_id', null).maybeSingle()
      if (existing) setPrefetchedConvId(existing.id)
    }
    prefetch()
  }, [profile])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (lightboxIdx === null) return
    if (e.key === 'Escape')     setLightboxIdx(null)
    if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null ? Math.min(i + 1, portfolioPhotos.length - 1) : null)
    if (e.key === 'ArrowLeft')  setLightboxIdx(i => i !== null ? Math.max(i - 1, 0) : null)
  }, [lightboxIdx, portfolioPhotos.length])

  useEffect(() => {
    if (lightboxIdx === null) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIdx, handleKeyDown])

  async function handleMessage() {
    if (!profile) return
    setMessaging(true)
    if (prefetchedConvId) { router.push(`/messages/${prefetchedConvId}`); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const customerId = prefetchedCustomerId ?? user.id
    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('customer_id', customerId).eq('provider_id', profile.user_id).is('booking_id', null).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: conv } = await supabase.from('conversations').insert({
      customer_id: customerId, provider_id: profile.user_id,
      conversation_type: 'direct', status: 'active',
    }).select('id').single()
    setMessaging(false)
    if (conv) router.push(`/messages/${conv.id}`)
  }

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
  if (!profile) return (
    <div className="text-gray-400 text-center py-20">
      Profile not found.{' '}
      <button onClick={() => router.back()} className="text-primary hover:underline">Go back</button>
    </div>
  )

  const tradingYear = profile.verified_at
    ? new Date(profile.verified_at).getFullYear()
    : profile.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()

  const displayName = profile.business_name?.trim() || `${titleCase(profile.first_name ?? '')} ${titleCase(profile.last_name ?? '')}`.trim()
  const initials = (profile.business_name?.trim()?.[0] || profile.first_name?.[0] || 'P').toUpperCase()

  const bio = profile.bio ?? ''
  const BIO_LIMIT = 300
  const bioTruncated = bio.length > BIO_LIMIT && !bioExpanded

  const areas: string[]     = profile.service_areas ?? profile.islands ?? []
  const trades: string[]    = profile.trade_categories ?? (profile.trade_category ? [profile.trade_category] : [])
  const licenses: string[]  = profile.licenses ?? []
  const languages: string[] = profile.languages ?? []

  const headline = trades.length > 0
    ? trades.map((t: string) => t.replace(/_/g, ' ')).join(' | ')
    : displayName

  // Only trust the rating aggregate when actual review rows back it — otherwise
  // a stale rating_average would contradict an empty Reviews section.
  const hasReviews  = allReviews.length > 0
  const rating      = hasReviews ? Number(profile.rating_average) : 0
  const reviewCount = hasReviews ? Math.max(profile.total_reviews ?? 0, allReviews.length) : 0
  const jobs   = profile.total_jobs_completed ?? 0
  const isTopRated = rating >= 4.7 && jobs >= 3

  const displayedReviews = showAllReviews ? allReviews : allReviews.slice(0, 3)

  return (
    <div className="w-full">

      {/* page action row */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={16} /> Back
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{displayName}</h1>
        </div>
      </div>

      {/* ─── CARD ─── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden flex flex-col min-h-[calc(100vh-8rem)]">

        {/* ── HEADER ── */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-start gap-5">

            {/* Avatar */}
            <div className="h-[84px] w-[84px] rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold overflow-hidden ring-2 ring-gray-100 shrink-0">
              {profile.profile_image_url
                ? <img src={profile.profile_image_url} alt="" className="h-full w-full object-cover" />
                : initials}
            </div>

            {/* Name block */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[1.375rem] font-bold text-gray-900 leading-tight">{displayName}</h2>
                {profile.identity_verified && <BadgeCheck size={21} className="text-primary shrink-0" />}
              </div>

              {profile.business_name && (profile.first_name || profile.last_name) && (
                <p className="text-sm text-gray-500 mt-0.5">{profile.first_name} {profile.last_name}</p>
              )}

              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1.5">
                <MapPin size={13} className="shrink-0" />
                {profile.city ? (
                  <span>{profile.city}, UK – <UKLocalTime /> local time</span>
                ) : areas.length > 0 ? (
                  <span>{areas[0]}, UK – <UKLocalTime /> local time</span>
                ) : (
                  <span>Location not set</span>
                )}
              </div>

              {/* Badge pills */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {isTopRated && (
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800">
                      <Crown size={10} className="text-white" />
                    </span>
                    Top Rated
                  </span>
                )}
                {profile.identity_verified && (
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800">
                      <BadgeCheck size={10} className="text-white" />
                    </span>
                    ID Verified
                  </span>
                )}
                {(profile.badges ?? []).map((badge: string) => (
                  <span key={badge} className="inline-flex items-center gap-1 rounded-full border-2 border-gray-800 px-3 py-0.5 text-xs font-semibold text-gray-800">
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* CTAs top-right */}
            <div className="flex flex-col items-end gap-3 shrink-0 pt-1">
              {profile.hourly_rate != null && (
                <p className="text-2xl font-bold text-gray-900">
                  £{profile.hourly_rate}<span className="text-base font-normal text-gray-500">/hr</span>
                </p>
              )}
              <Link
                href={`/bookings/new?provider=${profile.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
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
        <div className="border-t border-gray-100 px-8 py-6 flex items-start gap-12">
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

          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 capitalize leading-snug">{headline}</p>
            <p className="text-xs text-gray-500 mt-1">Member since {tradingYear}</p>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="border-t border-gray-100 flex flex-1">

          {/* ── SIDEBAR ── */}
          <aside className="w-60 shrink-0 border-r border-gray-100 px-7 py-7 space-y-7">

            {profile.avg_response_hours != null && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Avg. response</p>
                <p className="text-xl font-bold text-gray-900">{profile.avg_response_hours} hrs</p>
              </div>
            )}

            {profile.phone && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Phone</p>
                <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Phone size={13} /> {profile.phone}
                </a>
              </div>
            )}

            {profile.website && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Website</p>
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline max-w-full">
                  <Globe size={13} className="shrink-0" />
                  <span className="truncate">{profile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Verifications</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  ID:{' '}
                  {profile.identity_verified
                    ? <span className="text-primary font-medium inline-flex items-center gap-0.5">Verified <BadgeCheck size={13} /></span>
                    : <span className="text-gray-400">Not verified</span>}
                </p>
                {profile.phone && (
                  <p className="text-sm text-gray-600">
                    Phone: <span className="text-primary font-medium inline-flex items-center gap-0.5">Verified <BadgeCheck size={13} /></span>
                  </p>
                )}
                {profile.verification_status === 'verified' && (
                  <p className="text-sm text-gray-600 inline-flex items-center gap-1">
                    <Shield size={13} className="text-green-600 shrink-0" /> Documents verified
                  </p>
                )}
              </div>
            </div>

            {licenses.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Licenses</p>
                <div className="space-y-1.5">
                  {licenses.map((item: string, i: number) => {
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
                  {languages.map((item: string, i: number) => {
                    const [name, level] = item.split(':').map(s => s.trim())
                    return level ? (
                      <p key={i} className="text-sm text-gray-600">{titleCase(name)}: <span className="text-primary font-medium">{titleCase(level)}</span></p>
                    ) : (
                      <p key={i} className="text-sm text-gray-600">{titleCase(item)}</p>
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

          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 min-w-0 px-8 py-7 space-y-8">

            {/* Bio */}
            {bio ? (
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
            ) : null}

            {/* Work history */}
            <div className="border-t border-gray-100 pt-7">
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

              {/* Reviews */}
              {allReviews.length > 0 ? (
                <div className="border-t border-gray-100 pt-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <StarRow rating={rating} />
                    <p className="text-sm font-semibold text-gray-800">
                      {rating.toFixed(1)} · {Math.max(profile.total_reviews, allReviews.length)} review{Math.max(profile.total_reviews, allReviews.length) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {displayedReviews.map((rv: any) => (
                    <div key={rv.id} className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
                        {rv.reviewer_name
                          ? rv.reviewer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                          : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <StarRow rating={rv.rating} />
                            {rv.reviewer_name && (
                              <span className="text-sm font-semibold text-gray-700">{rv.reviewer_name}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{relativeDate(rv.created_at)}</span>
                        </div>
                        {rv.review_text && (
                          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                            {rv.review_text.length > 200 ? rv.review_text.slice(0, 200) + '…' : rv.review_text}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {allReviews.length > 3 && (
                    <button onClick={() => setShowAllReviews(v => !v)}
                      className="text-sm text-primary hover:underline">
                      {showAllReviews ? 'Show fewer' : `View all ${allReviews.length} reviews →`}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-5">No reviews yet.</p>
              )}
            </div>

            {/* Portfolio */}
            <div className="border-t border-gray-100 pt-7">
              <h3 className="text-base font-bold text-gray-900 mb-4">Portfolio</h3>
              {portfolioPhotos.length === 0 ? (
                <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 text-gray-300">
                  <ImageIcon size={28} />
                  <span className="text-xs">No portfolio photos yet</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {portfolioPhotos.map((photo: any, idx: number) => (
                    <div key={photo.id}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 cursor-pointer"
                      onClick={() => setLightboxIdx(idx)}>
                      <img src={photo.url} alt={photo.caption ?? ''}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightboxIdx !== null && portfolioPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}>
          {portfolioPhotos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => ((i ?? 0) - 1 + portfolioPhotos.length) % portfolioPhotos.length) }}
              className="absolute left-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors">
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="relative max-w-3xl max-h-[80vh] mx-16" onClick={e => e.stopPropagation()}>
            <img src={portfolioPhotos[lightboxIdx].url} alt={portfolioPhotos[lightboxIdx].caption ?? ''}
              className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl" />
            {portfolioPhotos[lightboxIdx].caption && (
              <p className="mt-3 text-center text-sm text-white/80">{portfolioPhotos[lightboxIdx].caption}</p>
            )}
          </div>
          {portfolioPhotos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => ((i ?? 0) + 1) % portfolioPhotos.length) }}
              className="absolute right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors">
              <ChevronRight size={22} />
            </button>
          )}
          <button onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors">
            <X size={16} />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
            {lightboxIdx + 1} / {portfolioPhotos.length}
          </p>
        </div>
      )}
    </div>
  )
}
