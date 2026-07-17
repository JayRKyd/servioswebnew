'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatTime, titleCase } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Calendar, Clock, Star, Bell, ChevronRight, Briefcase,
  PoundSterling, AlertCircle, CheckCircle, BarChart2,
  MessageSquare, FileText, ArrowRight, Zap, Shield,
} from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function relativeDate(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00'); d.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 6)
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

function dateBlock(dateStr: string, isToday: boolean) {
  const d = new Date(dateStr + 'T00:00:00')
  return (
    <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${
      isToday ? 'bg-primary text-white' : 'bg-gray-50 text-gray-700'
    }`}>
      <span className="text-[10px] font-semibold uppercase leading-none tracking-wide">
        {d.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
      <span className="text-xl font-bold leading-tight">{d.getDate()}</span>
    </div>
  )
}

function Avatar({ cp }: { cp: any }) {
  const initials = cp ? `${cp.first_name?.[0] ?? ''}${cp.last_name?.[0] ?? ''}`.toUpperCase() : '?'
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-bold text-primary">
      {cp?.profile_image_url
        ? <img src={cp.profile_image_url} alt="" className="h-9 w-9 object-cover" />
        : initials}
    </div>
  )
}

const QUICK_LINKS = [
  { label: 'Calendar',     href: '/provider/calendar',     icon: <Calendar size={18} />,     color: 'text-primary bg-primary/[0.08]' },
  { label: 'Requests',     href: '/provider/bookings',     icon: <Briefcase size={18} />,    color: 'text-purple-600 bg-purple-50' },
  { label: 'Earnings',     href: '/provider/earnings',     icon: <PoundSterling size={18} />,color: 'text-green-600 bg-green-50' },
  { label: 'Messages',     href: '/messages',              icon: <MessageSquare size={18} />, color: 'text-teal-600 bg-teal-50' },
  { label: 'Analytics',   href: '/provider/analytics',    icon: <BarChart2 size={18} />,    color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Availability', href: '/provider/availability', icon: <Clock size={18} />,        color: 'text-orange-600 bg-orange-50' },
]

export default function ProviderDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(async ({ data: p }) => {
        setProfile(p)
        if (!p) { setLoading(false); return }

        const todayStr = new Date().toISOString().split('T')[0]

        const [{ data: allB }, { data: upB }, { data: notifs }] = await Promise.all([
          supabase.from('bookings')
            .select('*, service:services(title), customer_profile:customer_profiles(first_name, last_name, profile_image_url)')
            .eq('provider_id', p.id)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase.from('bookings')
            .select('*, service:services(title), customer_profile:customer_profiles(first_name, last_name, profile_image_url)')
            .eq('provider_id', p.id)
            .in('status', ['accepted', 'in_progress'])
            .gte('scheduled_date', todayStr)
            .order('scheduled_date', { ascending: true })
            .order('scheduled_time_start', { ascending: true })
            .limit(5),
          supabase.from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(4),
        ])

        setBookings(allB ?? [])
        setUpcoming(upB ?? [])
        setNotifications(notifs ?? [])
        setLoading(false)
      })
  }, [user?.id])

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const pending   = bookings.filter(b => b.status === 'pending')
  const thisMonthNet = bookings
    .filter(b => b.status === 'completed' && b.scheduled_date >= monthStart)
    .reduce((s, b) => s + ((b.base_amount ?? b.total_amount ?? 0) - (b.platform_fee ?? 0)), 0)

  const name = profile?.first_name ?? 'there'
  const nextJob = upcoming[0]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute -right-2 top-14 h-28 w-28 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/60">{greeting()}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{name}</h1>
            {profile?.business_name && (
              <p className="mt-0.5 text-sm text-white/60">{profile.business_name}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {profile?.trade_category && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium capitalize">
                  {profile.trade_category.replace(/_/g, ' ')}
                </span>
              )}
              {profile?.identity_verified ? (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <CheckCircle size={10} /> Verified
                </span>
              ) : (
                <Link href="/provider/documents"
                  className="flex items-center gap-1 rounded-full bg-amber-400/30 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-400/40 transition-colors">
                  <Shield size={10} /> Unverified — upload docs
                </Link>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-white/50">
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)}
            </p>
            {pending.length > 0 && (
              <Link href="/provider/bookings"
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-red-400/25 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-400/35 transition-colors">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-400 text-[9px] font-bold text-white">
                  {pending.length}
                </span>
                pending request{pending.length !== 1 ? 's' : ''}
                <ChevronRight size={11} />
              </Link>
            )}
            {nextJob && (
              <p className="mt-2 text-xs text-white/50">
                Next job: <span className="text-white/80 font-medium">{relativeDate(nextJob.scheduled_date)}{nextJob.scheduled_time_start ? ' · ' + formatTime(nextJob.scheduled_time_start) : ''}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/provider/bookings"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pending</p>
            <div className={`rounded-xl p-1.5 ${pending.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <AlertCircle size={14} className={pending.length > 0 ? 'text-red-500' : 'text-gray-300'} />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${pending.length > 0 ? 'text-red-500' : 'text-gray-900'}`}>
            {pending.length}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            {pending.length > 0 ? 'Need your response' : 'All caught up ✓'}
          </p>
        </Link>

        <Link href="/provider/calendar"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Upcoming</p>
            <div className="rounded-xl bg-primary/[0.08] p-1.5">
              <Calendar size={14} className="text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{upcoming.length}</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {nextJob ? `Next: ${relativeDate(nextJob.scheduled_date)}` : 'No upcoming jobs'}
          </p>
        </Link>

        <Link href="/provider/earnings"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">This Month</p>
            <div className="rounded-xl bg-green-50 p-1.5">
              <PoundSterling size={14} className="text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{formatCurrency(thisMonthNet / 100)}</p>
          <p className="mt-1.5 text-xs text-gray-400">net after commission</p>
        </Link>

        <Link href="/provider/analytics"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rating</p>
            <div className="rounded-xl bg-amber-50 p-1.5">
              <Star size={14} className="text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">
            {profile?.rating_average ? profile.rating_average.toFixed(1) : '—'}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            {profile?.total_reviews
              ? `from ${profile.total_reviews} review${profile.total_reviews !== 1 ? 's' : ''}`
              : 'No reviews yet'}
          </p>
        </Link>
      </div>

      {/* ── Pending attention banner ── */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2 shrink-0">
              <Zap size={15} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pending.length} booking request{pending.length !== 1 ? 's' : ''} waiting for your response
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                Quick responses improve your acceptance rate and visibility
              </p>
            </div>
          </div>
          <Link href="/provider/bookings"
            className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors">
            Review now
          </Link>
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_288px]">

        {/* Left column */}
        <div className="space-y-5">

          {/* Upcoming Jobs */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900">Upcoming Jobs</h2>
                {upcoming.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {upcoming.length}
                  </span>
                )}
              </div>
              <Link href="/provider/calendar" className="text-xs font-medium text-primary hover:underline">
                View calendar →
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-50">
                  <Calendar size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No upcoming jobs yet</p>
                <p className="max-w-xs text-xs leading-relaxed text-gray-500">
                  Jobs appear here when customers book you. Complete your profile and
                  verification to rank higher in search and win your first booking.
                </p>
                <Link
                  href="/provider/profile"
                  className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
                >
                  Complete your profile
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcoming.map(b => {
                  const isToday = b.scheduled_date === todayStr
                  const cp = b.customer_profile
                  const customerName = cp ? `${titleCase(cp.first_name ?? '')} ${titleCase(cp.last_name ?? '')}`.trim() : 'Customer'
                  return (
                    <Link key={b.id} href={`/provider/bookings/${b.id}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60">
                      {dateBlock(b.scheduled_date, isToday)}
                      <Avatar cp={cp} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{b.service?.title ?? 'Job'}</p>
                        <div className="mt-0.5 flex items-center gap-2.5 text-xs text-gray-400">
                          <span>{customerName}</span>
                          {b.scheduled_time_start && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="flex items-center gap-1">
                                <Clock size={10} />{formatTime(b.scheduled_time_start)}
                              </span>
                            </>
                          )}
                          {b.is_emergency && (
                            <>
                              <span className="text-gray-200">·</span>
                              <span className="font-medium text-red-500">Emergency</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <StatusBadge status={b.status} />
                        <p className="text-xs font-semibold text-gray-500">
                          {formatCurrency((b.base_amount ?? b.total_amount ?? 0) / 100)}
                        </p>
                      </div>
                      <ChevronRight size={14} className="shrink-0 text-gray-200 transition-colors group-hover:text-primary" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {pending.length > 0 && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900">Pending Requests</h2>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-500">
                    {pending.length}
                  </span>
                </div>
                <Link href="/provider/bookings" className="text-xs font-medium text-primary hover:underline">
                  View all →
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {pending.slice(0, 4).map(b => {
                  const cp = b.customer_profile
                  const customerName = cp ? `${titleCase(cp.first_name ?? '')} ${titleCase(cp.last_name ?? '')}`.trim() : 'Customer'
                  return (
                    <Link key={b.id} href={`/provider/bookings/${b.id}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/60">
                      <Avatar cp={cp} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{b.service?.title ?? 'Job'}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {customerName} · {relativeDate(b.scheduled_date)}
                          {b.scheduled_time_start ? ' at ' + formatTime(b.scheduled_time_start) : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatCurrency((b.base_amount ?? b.total_amount ?? 0) / 100)}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                          Pending
                        </span>
                        <ChevronRight size={14} className="text-gray-200 transition-colors group-hover:text-primary" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Quick links */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">Quick Links</h2>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_LINKS.map(l => (
                <Link key={l.label} href={l.href}
                  className="group flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors hover:bg-gray-50">
                  <div className={`rounded-xl p-2 ${l.color}`}>{l.icon}</div>
                  <span className="text-[11px] font-medium text-gray-500 group-hover:text-gray-800">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Notifications</h2>
              {notifications.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Bell size={20} className="text-gray-200" />
                <p className="text-xs text-gray-400">No unread notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map(n => (
                  <div key={n.id} className="px-5 py-3.5">
                    <p className="text-xs font-semibold leading-snug text-gray-800">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-400">{n.body}</p>
                    <p className="mt-1 text-[10px] text-gray-300">
                      {new Intl.DateTimeFormat('en-GB', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      }).format(new Date(n.created_at))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verify nudge — only if not verified */}
          {!profile?.identity_verified && (
            <Link href="/provider/documents"
              className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.08] p-4 transition-colors hover:border-primary/40">
              <div className="shrink-0 rounded-xl bg-primary/10 p-2">
                <FileText size={15} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Complete verification</p>
                <p className="mt-0.5 text-xs leading-relaxed text-primary">
                  Upload your documents to earn your verified badge and rank higher in search.
                </p>
              </div>
              <ArrowRight size={14} className="mt-0.5 shrink-0 text-primary/60" />
            </Link>
          )}

        </div>
      </div>
    </div>
  )
}
