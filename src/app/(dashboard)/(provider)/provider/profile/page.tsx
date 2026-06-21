'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { Star, Briefcase, MapPin, Calendar, ShieldCheck } from 'lucide-react'

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const sz = size === 'xs' ? 'text-xs' : 'text-sm'
  return (
    <span className={`text-amber-400 ${sz}`}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

function relativeReviewDate(iso: string): string {
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

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('reviews').select('*').eq('reviewee_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([{ data: p }, { data: r }]) => {
      setProfile(p)
      setLatestReview(r)
      setLoading(false)
    })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return <div className="text-gray-400">Profile not found. <Link href="/provider/profile/edit" className="text-primary hover:underline">Create your profile →</Link></div>

  const currentYear = new Date().getFullYear()
  const tradingYear = profile.verified_at
    ? new Date(profile.verified_at).getFullYear()
    : profile.created_at
      ? new Date(profile.created_at).getFullYear()
      : currentYear

  const tradingYears = currentYear - tradingYear
  const tradingSince = tradingYear

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Link href="/provider/profile/edit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Edit Profile</Link>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {profile.profile_image_url
              ? <img src={profile.profile_image_url} alt="" className="h-16 w-16 rounded-full object-cover" />
              : (profile.first_name?.[0] ?? 'P').toUpperCase()
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-gray-900">{profile.business_name ?? `${profile.first_name} ${profile.last_name}`}</p>
            <p className="text-sm text-gray-500">{profile.first_name} {profile.last_name}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {profile.identity_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  <ShieldCheck size={11} /> Verified
                </span>
              )}
              {profile.badges?.map((badge: string) => (
                <span key={badge} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <ShieldCheck size={11} /> {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t pt-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Briefcase size={13} />
              <span className="text-xs">Jobs</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{profile.total_jobs_completed ?? 0}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Star size={13} />
              <span className="text-xs">Rating</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {Number(profile.rating_average) > 0 ? Number(profile.rating_average).toFixed(1) : '—'}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <MapPin size={13} />
              <span className="text-xs">Radius</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {profile.max_travel_distance ? `${profile.max_travel_distance}mi` : '—'}
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
              <Calendar size={13} />
              <span className="text-xs">Since</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{tradingSince}</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio ? (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">About</p>
            <p className="text-sm text-gray-700 leading-relaxed">{profile.bio}</p>
          </div>
        ) : (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-400 italic">
              No bio added yet.{' '}
              <Link href="/provider/profile/edit" className="text-primary not-italic hover:underline">Add a bio →</Link>
            </p>
          </div>
        )}

        {/* Trade categories */}
        {profile.trade_categories?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-2">Trades</p>
            <div className="flex flex-wrap gap-2">
              {profile.trade_categories.map((t: string) => (
                <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 capitalize">{t.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
        )}

        {/* Contact info */}
        {(profile.hourly_rate || profile.phone || profile.website) && (
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            {profile.hourly_rate && <div><p className="text-xs text-gray-400">Hourly Rate</p><p className="font-medium text-sm">£{profile.hourly_rate}/hr</p></div>}
            {profile.phone && <div><p className="text-xs text-gray-400">Phone</p><p className="font-medium text-sm">{profile.phone}</p></div>}
            {profile.website && <div className="col-span-2"><p className="text-xs text-gray-400">Website</p><p className="font-medium text-sm text-primary">{profile.website}</p></div>}
          </div>
        )}

        {/* Service areas */}
        {profile.islands?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-2">Service Areas</p>
            <div className="flex flex-wrap gap-2">
              {profile.islands.map((island: string) => (
                <span key={island} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary">{island}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest review */}
      {latestReview && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Latest Review</h2>
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
              {latestReview.reviewer_name
                ? latestReview.reviewer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                : '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <Stars rating={latestReview.rating} size="xs" />
                <span className="text-xs text-gray-400">{relativeReviewDate(latestReview.created_at)}</span>
              </div>
              {latestReview.review_text && (
                <p className="mt-1 text-sm text-gray-700">
                  {latestReview.review_text.length > 120
                    ? latestReview.review_text.slice(0, 120) + '…'
                    : latestReview.review_text}
                </p>
              )}
            </div>
          </div>
          <Link href="/provider/reviews" className="block text-xs text-primary hover:underline">View all reviews →</Link>
        </div>
      )}
    </div>
  )
}
