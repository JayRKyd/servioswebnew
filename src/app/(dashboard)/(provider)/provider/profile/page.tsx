'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import {
  Star,
  BadgeCheck,
  MapPin,
  Share2,
  MoreHorizontal,
  ArrowUpDown,
  Crown,
} from 'lucide-react'

function UKLocalTime() {
  const [time, setTime] = useState('')
  useEffect(() => {
    function update() {
      setTime(
        new Intl.DateTimeFormat('en-GB', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Europe/London',
        }).format(new Date())
      )
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])
  return <>{time}</>
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={
            i <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-200 text-gray-200'
          }
        />
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

export default function ProviderProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [latestReview, setLatestReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bioExpanded, setBioExpanded] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('reviews')
        .select('*')
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: p }, { data: r }]) => {
      setProfile(p)
      setLatestReview(r)
      setLoading(false)
    })
  }, [user?.id])

  if (loading)
    return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  if (!profile)
    return (
      <div className="text-gray-400">
        Profile not found.{' '}
        <Link href="/provider/profile/edit" className="text-primary hover:underline">
          Create your profile →
        </Link>
      </div>
    )

  const tradingYear = profile.verified_at
    ? new Date(profile.verified_at).getFullYear()
    : profile.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear()

  const displayName =
    profile.business_name ?? `${profile.first_name} ${profile.last_name}`
  const initials = (
    profile.business_name?.[0] ??
    profile.first_name?.[0] ??
    'P'
  ).toUpperCase()

  const bio = profile.bio ?? ''
  const BIO_LIMIT = 300
  const bioTruncated = bio.length > BIO_LIMIT

  const areas: string[] = profile.service_areas ?? profile.islands ?? []
  const trades: string[] = profile.trade_categories ?? []

  // headline shown in stats strip (like Upwork's title)
  const headline =
    trades.length > 0
      ? trades.map((t: string) => t.replace(/_/g, ' ')).join(' | ')
      : displayName

  const rating = Number(profile.rating_average)
  const jobs = profile.total_jobs_completed ?? 0
  const isTopRated = rating >= 4.7 && jobs >= 3

  return (
    <div className="w-full">
      {/* page action row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <Link
          href="/provider/profile/edit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          Edit Profile
        </Link>
      </div>

      {/* ─── CARD ─── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">

        {/* ── HEADER ── */}
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">

            {/* Avatar + online dot */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                {profile.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {/* green online dot — bottom-left like Upwork */}
              <span className="absolute bottom-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-green-400 ring-2 ring-white" />
            </div>

            {/* Name / location / badges */}
            <div className="flex-1 min-w-0">
              {/* Name + verified badge inline */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 leading-snug">
                  {displayName}
                </h2>
                {profile.identity_verified && (
                  <BadgeCheck size={20} className="text-primary shrink-0" />
                )}
              </div>

              {/* Sub-name (personal name when business_name set) */}
              {profile.business_name && (profile.first_name || profile.last_name) && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {profile.first_name} {profile.last_name}
                </p>
              )}

              {/* Location + local time — matches Upwork style */}
              {(profile.city || areas.length > 0) && (
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <MapPin size={13} className="shrink-0" />
                  <span>
                    {profile.city ?? areas[0]}, UK
                    {' – '}
                    <UKLocalTime /> local time
                  </span>
                </div>
              )}

              {/* Badge pills — filled icon in circle + text, Upwork style */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
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
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-gray-800 px-3 py-0.5 text-xs font-semibold text-gray-800"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Top-right: ellipsis + share */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50">
                <MoreHorizontal size={16} />
              </button>
              <button className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Share <Share2 size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ── STATS STRIP ── */}
        <div className="border-t border-gray-100 px-6 py-5 flex items-start gap-10">
          {/* Jobs */}
          <div className="shrink-0">
            <p className="text-xl font-bold text-gray-900">{jobs > 0 ? jobs : '0'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Jobs completed</p>
          </div>

          {/* Rating */}
          <div className="shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xl font-bold text-gray-900">
                {rating > 0 ? rating.toFixed(1) : '—'}
              </p>
              {rating > 0 && <StarRow rating={rating} />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Rating</p>
          </div>

          {/* Headline — takes remaining space like Upwork's title */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 capitalize leading-snug">
              {headline}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Member since {tradingYear}</p>
          </div>

          {/* Rate — right-aligned */}
          {profile.hourly_rate && (
            <div className="shrink-0 text-right">
              <p className="text-xl font-bold text-gray-900">
                £{profile.hourly_rate}
                <span className="text-sm font-normal text-gray-500">/hr</span>
              </p>
            </div>
          )}
        </div>

        {/* ── BODY: sidebar + main ── */}
        <div className="border-t border-gray-100 flex min-h-0">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="w-56 shrink-0 border-r border-gray-100 px-6 py-6 space-y-6">

            {profile.avg_response_hours != null && (
              <div>
                <p className="text-sm font-semibold text-gray-800">Avg. response</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {profile.avg_response_hours < 1
                    ? 'Under 1 hour'
                    : profile.avg_response_hours === 1
                    ? '1 hour'
                    : `${profile.avg_response_hours} hours`}
                </p>
              </div>
            )}

            {profile.max_travel_distance && (
              <div>
                <p className="text-sm font-semibold text-gray-800">Service radius</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Up to {profile.max_travel_distance} miles
                </p>
              </div>
            )}

            {profile.phone && (
              <div>
                <p className="text-sm font-semibold text-gray-800">Phone</p>
                <p className="text-sm text-gray-500 mt-0.5">{profile.phone}</p>
              </div>
            )}

            {profile.website && (
              <div>
                <p className="text-sm font-semibold text-gray-800">Website</p>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all mt-0.5 block"
                >
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}

            {/* Verifications — "Label: Value ✓" format matching Upwork exactly */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Verifications</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  ID:{' '}
                  {profile.identity_verified ? (
                    <span className="text-primary font-medium inline-flex items-center gap-0.5">
                      Verified <BadgeCheck size={13} />
                    </span>
                  ) : (
                    <span className="text-gray-400">Not verified</span>
                  )}
                </p>
                {profile.phone && (
                  <p className="text-sm text-gray-600">
                    Phone number:{' '}
                    <span className="text-primary font-medium inline-flex items-center gap-0.5">
                      Verified <BadgeCheck size={13} />
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Licenses */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Licenses</p>
              {(profile.licenses ?? []).length > 0 ? (
                <div className="space-y-1">
                  {(profile.licenses as string[]).map((lic) => (
                    <p key={lic} className="text-sm text-gray-600">{lic}</p>
                  ))}
                </div>
              ) : (
                <Link href="/provider/profile/edit" className="text-xs text-primary hover:underline">
                  Add a licence →
                </Link>
              )}
            </div>

            {/* Languages */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Languages</p>
              {(profile.languages ?? []).length > 0 ? (
                <div className="space-y-1">
                  {(profile.languages as string[]).map((lang) => {
                    const [name, level] = lang.split(':').map((s) => s.trim())
                    return (
                      <p key={lang} className="text-sm text-gray-600">
                        {name}:{' '}
                        <span className="text-primary font-medium">{level ?? 'Fluent'}</span>
                      </p>
                    )
                  })}
                </div>
              ) : (
                <Link href="/provider/profile/edit" className="text-xs text-primary hover:underline">
                  Add a language →
                </Link>
              )}
            </div>

            {/* Service areas */}
            {areas.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Service areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map((area: string) => (
                    <span
                      key={area}
                      className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* City (editable via profile settings) */}
            {!profile.city && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Location</p>
                <Link
                  href="/provider/profile/edit"
                  className="text-xs text-primary hover:underline"
                >
                  Add your city →
                </Link>
              </div>
            )}
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 min-w-0 px-6 py-5 space-y-0">

            {/* Bio — no heading, text flows directly like Upwork */}
            <div>
              {bio ? (
                <>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {bioExpanded || !bioTruncated
                      ? bio
                      : bio.slice(0, BIO_LIMIT) + '…'}
                  </p>
                  {bioTruncated && (
                    <button
                      onClick={() => setBioExpanded((v) => !v)}
                      className="mt-1 text-sm text-primary underline hover:no-underline"
                    >
                      {bioExpanded ? 'less' : 'more'}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  No bio added yet.{' '}
                  <Link
                    href="/provider/profile/edit"
                    className="text-primary not-italic hover:underline"
                  >
                    Add a bio →
                  </Link>
                </p>
              )}
            </div>

            {/* Work history */}
            <div className="border-t border-gray-100 mt-5 pt-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold text-gray-900">Work history</h3>
                <button className="h-7 w-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50">
                  <ArrowUpDown size={13} />
                </button>
              </div>

              {/* Insight chips — trade categories as "Insights from completed jobs" */}
              {trades.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Trades &amp; services
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trades.map((t: string) => (
                      <span
                        key={t}
                        className="rounded-full border border-gray-300 px-3 py-0.5 text-sm text-gray-700 capitalize"
                      >
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest review */}
              {latestReview ? (
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
                      {latestReview.reviewer_name
                        ? latestReview.reviewer_name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                        : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StarRow rating={latestReview.rating} />
                          {latestReview.reviewer_name && (
                            <span className="text-xs font-semibold text-gray-700">
                              {latestReview.reviewer_name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {relativeDate(latestReview.created_at)}
                        </span>
                      </div>
                      {latestReview.review_text && (
                        <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
                          {latestReview.review_text.length > 200
                            ? latestReview.review_text.slice(0, 200) + '…'
                            : latestReview.review_text}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/provider/reviews"
                    className="block text-sm text-primary hover:underline"
                  >
                    View all reviews →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-4">
                  No reviews yet.
                </p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
