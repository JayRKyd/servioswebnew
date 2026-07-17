'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatCurrency, formatTime, titleCase } from '@/lib/utils'
import { CATEGORY_META } from '@/lib/service-questions'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  CalendarDays, MessageSquare, Star, PoundSterling,
  ClipboardList, Search, ChevronRight, CheckCircle, Clock,
  Droplets, Zap, Sparkles, Wind, Paintbrush, Wrench,
} from 'lucide-react'

const CATEGORY_TILE_ICONS: Record<string, React.ElementType> = {
  plumber:     Droplets,
  electrician: Zap,
  cleaner:     Sparkles,
  hvac:        Wind,
  painter:     Paintbrush,
  handyman:    Wrench,
}

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
  if (diff > 1 && diff <= 6)
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

function dateBlock(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isToday = d.getTime() === today.getTime()
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

const QUICK_LINKS = [
  { label: 'Get Quotes',     href: '/book',      icon: <Search size={18} />,       color: 'text-primary bg-primary/[0.08]' },
  { label: 'My Bookings',    href: '/bookings',  icon: <ClipboardList size={18} />, color: 'text-purple-600 bg-purple-50' },
  { label: 'Messages',       href: '/messages',  icon: <MessageSquare size={18} />, color: 'text-teal-600 bg-teal-50' },
  { label: 'Reviews',        href: '/reviews',   icon: <Star size={18} />,          color: 'text-amber-600 bg-amber-50' },
]

const heroCategories = ['plumber', 'electrician', 'cleaner', 'hvac', 'painter', 'handyman']

export default function CustomerDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle()
      .then(async ({ data: cp }) => {
        setProfile(cp)
        if (!cp) { setLoading(false); return }
        const { data } = await supabase
          .from('bookings')
          .select('*, service:services(title)')
          .eq('customer_id', cp.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setBookings(data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user?.id])

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const pending  = bookings.filter(b => b.status === 'pending')
  const active   = bookings.filter(b => ['accepted', 'in_progress'].includes(b.status))
  const upcoming = bookings
    .filter(b => ['accepted', 'in_progress'].includes(b.status) && b.scheduled_date >= todayStr)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const completed = bookings.filter(b => b.status === 'completed')
  const totalSpent = completed.reduce((s, b) => s + (b.total_amount ?? 0), 0)
  const nextJob = upcoming[0]
  const recent = bookings.slice(0, 5)

  const name = profile?.first_name ? titleCase(profile.first_name) : 'there'

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

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
            <p className="mt-0.5 text-sm text-white/60">What can we help you with today?</p>
            <Link
              href="/book"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 transition-colors"
            >
              <Search size={14} /> Get quotes
            </Link>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs text-white/50">
              {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
            </p>
            {nextJob && (
              <Link href={'/bookings/' + nextJob.id}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/25 transition-colors">
                <Clock size={11} />
                {relativeDate(nextJob.scheduled_date)}
                {nextJob.scheduled_time_start ? ' · ' + formatTime(nextJob.scheduled_time_start) : ''}
                <ChevronRight size={11} />
              </Link>
            )}
            {pending.length > 0 && (
              <Link href="/bookings"
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-400/30 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/40 transition-colors">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                  {pending.length}
                </span>
                awaiting confirmation
                <ChevronRight size={11} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/bookings?status=pending"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Pending</p>
            <div className={`rounded-xl p-1.5 ${pending.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <Clock size={14} className={pending.length > 0 ? 'text-amber-500' : 'text-gray-300'} />
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${pending.length > 0 ? 'text-amber-500' : 'text-gray-900'}`}>
            {pending.length}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            {pending.length > 0 ? 'Awaiting provider' : 'Nothing pending'}
          </p>
        </Link>

        <Link href="/bookings"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active</p>
            <div className="rounded-xl bg-primary/[0.08] p-1.5">
              <CalendarDays size={14} className="text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{active.length}</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {nextJob ? `Next: ${relativeDate(nextJob.scheduled_date)}` : 'No active bookings'}
          </p>
        </Link>

        <Link href="/bookings"
          className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-primary/20">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Completed</p>
            <div className="rounded-xl bg-green-50 p-1.5">
              <CheckCircle size={14} className="text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">{completed.length}</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {completed.length > 0 ? 'jobs finished' : 'None yet'}
          </p>
        </Link>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Spent</p>
            <div className="rounded-xl bg-purple-50 p-1.5">
              <PoundSterling size={14} className="text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-gray-900">
            {formatCurrency(totalSpent / 100)}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">across all bookings</p>
        </div>
      </div>

      {/* ── Upcoming jobs ── */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming</h2>
            <Link href="/bookings" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {upcoming.slice(0, 3).map(b => (
              <Link key={b.id} href={'/bookings/' + b.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                {dateBlock(b.scheduled_date)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{b.service?.title ?? 'Booking'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {relativeDate(b.scheduled_date)}
                    {b.scheduled_time_start ? ' · ' + formatTime(b.scheduled_time_start) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={b.status} />
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick links + service categories ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">

        {/* Quick links */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick access</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map(({ label, href, icon, color }) => (
              <Link key={href} href={href}
                className="flex flex-col items-center gap-2 rounded-xl p-4 text-center ring-1 ring-gray-100 hover:ring-primary/20 hover:bg-primary/[0.04] transition-all">
                <div className={`rounded-xl p-2.5 ${color}`}>{icon}</div>
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Service categories */}
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-5 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Browse services</h2>
          <div className="grid grid-cols-3 gap-2">
            {heroCategories.map((key) => {
              const meta = CATEGORY_META[key]
              const Icon = CATEGORY_TILE_ICONS[key] ?? Wrench
              return (
                <Link key={key} href={`/book?category=${key}`}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-gray-50 px-2 py-3 text-center hover:bg-primary/[0.08] hover:ring-1 hover:ring-primary/20 transition-all">
                  <Icon size={18} className="text-primary" />
                  <span className="text-[11px] font-medium text-gray-600">{meta?.label}</span>
                </Link>
              )
            })}
          </div>
          <Link href="/book"
            className="mt-3 flex items-center justify-center gap-1 text-xs text-primary hover:underline">
            View all services →
          </Link>
        </div>
      </div>

      {/* ── Recent bookings ── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Recent Bookings</h2>
          <Link href="/bookings" className="text-xs text-primary hover:underline">View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="rounded-2xl bg-gray-50 p-4">
              <ClipboardList size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-700">Your bookings will appear here</p>
            <p className="max-w-xs text-center text-xs text-gray-500 leading-relaxed">
              Once you book a service, you'll be able to track it, message your provider, and leave a review — all from here.
            </p>
            <Link href="/book"
              className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
              Get your first quotes →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(b => (
              <Link key={b.id} href={'/bookings/' + b.id}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.service?.title ?? 'Booking'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(b.scheduled_date)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={b.status} />
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(b.total_amount / 100)}</span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
