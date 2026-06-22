'use client'
import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { formatDate, formatCurrency, titleCase } from '@/lib/utils'
import { Star, BadgeCheck, MapPin, Clock, MessageSquare, CalendarCheck, Shield, ChevronLeft } from 'lucide-react'
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
        <Star key={n} size={size} className={n <= Math.round(rating) ? 'fill-amber-400 stroke-amber-400' : 'fill-gray-200 stroke-gray-200'} />
      ))}
    </span>
  )
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-xs text-gray-500 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-xs text-gray-400">{pct}%</span>
    </div>
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
  const [services, setServices] = useState<ProviderService[]>([])
  const [reviews, setReviews]   = useState<Review[]>([])
  const [loading, setLoading]   = useState(true)
  const [messaging, setMessaging] = useState(false)

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
        supabase
          .from('provider_services')
          .select('id, service:services(title, description, base_price)')
          .eq('provider_id', pp.id)
          .eq('is_active', true)
          .limit(10),
        supabase
          .from('reviews')
          .select('id, rating, review_text, created_at, reviewer:customer_profiles(first_name, last_name)')
          .eq('reviewee_id', pp.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setServices((svcs ?? []) as any)
      setReviews((revs ?? []) as any)
      setLoading(false)
    }
    load()
  }, [id])

  async function handleMessage() {
    setMessaging(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (!cp || !provider) { setMessaging(false); return }

    const { data: existing } = await supabase
      .from('conversations').select('id')
      .eq('customer_id', cp.id).eq('provider_id', provider.id).is('booking_id', null)
      .maybeSingle()

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
      <button onClick={() => router.back()} className="mt-4 text-primary hover:underline text-sm">← Go back</button>
    </div>
  )

  const displayName = provider.business_name
    ?? `${titleCase(provider.first_name)} ${titleCase(provider.last_name)}`
  const initials = provider.business_name
    ? provider.business_name.charAt(0).toUpperCase()
    : `${provider.first_name?.[0] ?? ''}${provider.last_name?.[0] ?? ''}`.toUpperCase()
  const meta = provider.trade_category ? CATEGORY_META[provider.trade_category] : null

  // Rating breakdown
  const ratingCounts = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
  }))

  const memberSince = provider.created_at
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(provider.created_at))
    : null

  return (
    <div className="pb-16">
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* ── Left: main content ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Hero */}
          <div className="flex items-start gap-5">
            <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ${meta?.color ?? 'bg-gray-100'} flex items-center justify-center shadow-sm`}>
              {provider.profile_image_url ? (
                <img src={provider.profile_image_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className={`text-3xl font-bold opacity-40 ${meta?.accent ?? 'text-gray-400'}`}>{initials}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
                {provider.identity_verified && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <BadgeCheck size={11} /> Verified
                  </span>
                )}
              </div>
              {meta && (
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color} ${meta.accent}`}>
                  {meta.label}
                </span>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                {provider.rating_average > 0 && (
                  <span className="flex items-center gap-1.5">
                    <StarRow rating={provider.rating_average} size={13} />
                    <span className="font-medium text-gray-700">{provider.rating_average.toFixed(1)}</span>
                    <span>({provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''})</span>
                  </span>
                )}
                {provider.service_areas?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> {provider.service_areas.slice(0, 3).join(', ')}
                  </span>
                )}
                {memberSince && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> Member since {memberSince}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* About */}
          {provider.bio && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">About</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{provider.bio}</p>
            </div>
          )}

          {/* Services */}
          {services.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Services offered</h2>
              <div className="divide-y divide-gray-50">
                {services.map(sv => (
                  <div key={sv.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{sv.service?.title}</p>
                      {sv.service?.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{sv.service.description}</p>
                      )}
                    </div>
                    {sv.service?.base_price != null && (
                      <span className="text-sm font-semibold text-gray-900 shrink-0 ml-4">
                        {formatCurrency(sv.service.base_price / 100)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-5">Reviews</h2>

              {/* Rating summary */}
              <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-50">
                <div className="text-center">
                  <p className="text-5xl font-bold text-gray-900">{provider.rating_average.toFixed(1)}</p>
                  <StarRow rating={provider.rating_average} size={14} />
                  <p className="text-xs text-gray-400 mt-1">{provider.total_reviews} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {ratingCounts.map(({ star, count }) => (
                    <RatingBar key={star} label={`${star}★`} count={count} total={reviews.length} />
                  ))}
                </div>
              </div>

              {/* Individual reviews */}
              <div className="space-y-5">
                {reviews.map(rv => {
                  const reviewerName = rv.reviewer
                    ? `${titleCase(rv.reviewer.first_name)} ${titleCase(rv.reviewer.last_name)}`
                    : 'Customer'
                  const reviewerInitial = rv.reviewer?.first_name?.[0]?.toUpperCase() ?? 'C'
                  return (
                    <div key={rv.id} className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {reviewerInitial}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">{reviewerName}</p>
                          <StarRow rating={rv.rating} size={11} />
                        </div>
                        {rv.review_text && (
                          <p className="text-sm text-gray-600 leading-relaxed">{rv.review_text}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatDate(rv.created_at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {reviews.length === 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 text-center">
              <p className="text-sm text-gray-400">No reviews yet — be the first to book!</p>
            </div>
          )}
        </div>

        {/* ── Right: sticky sidebar ──────────────────────────────────────── */}
        <div className="w-full lg:w-[300px] shrink-0 lg:sticky lg:top-6 space-y-4">

          {/* Booking card */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 space-y-4">
            {provider.hourly_rate != null && (
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  £{provider.hourly_rate}<span className="text-base font-normal text-gray-500">/hr</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Hourly rate · final price set per job</p>
              </div>
            )}

            <Link
              href={`/bookings/new?provider=${provider.user_id}${context ? `&context=${encodeURIComponent(context)}` : ''}`}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
            >
              <CalendarCheck size={15} /> Book this provider
            </Link>

            <button
              onClick={handleMessage}
              disabled={messaging}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <MessageSquare size={15} /> {messaging ? 'Opening…' : 'Send a message'}
            </button>
          </div>

          {/* Trust signals */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 space-y-3">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Trust & Safety</h3>
            <div className="space-y-2.5">
              {provider.identity_verified && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <BadgeCheck size={15} className="text-primary shrink-0" />
                  <span>Identity verified</span>
                </div>
              )}
              {provider.verification_status === 'verified' && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Shield size={15} className="text-green-600 shrink-0" />
                  <span>Documents verified</span>
                </div>
              )}
              {provider.service_areas?.length > 0 && (
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>Serves {provider.service_areas.join(', ')}</span>
                </div>
              )}
              {memberSince && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Clock size={15} className="text-gray-400 shrink-0" />
                  <span>Member since {memberSince}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
