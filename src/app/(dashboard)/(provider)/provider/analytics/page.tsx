'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatCurrency, titleCase } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Briefcase, CheckCircle, TrendingUp, PoundSterling, Star, MessageSquare } from 'lucide-react'

/* ── Line chart ── */
function LineChart({ data }: { data: { label: string; jobs: number }[] }) {
  const W = 600, H = 120
  const PAD = { t: 12, r: 40, b: 28, l: 8 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const max = Math.max(...data.map(d => d.jobs), 1)

  const pts = data.map((d, i) => ({
    x: PAD.l + (i / Math.max(data.length - 1, 1)) * cW,
    y: PAD.t + cH - (d.jobs / max) * cH,
    ...d,
  }))

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + cH).toFixed(1)} L ${PAD.l},${(PAD.t + cH).toFixed(1)} Z`

  const showEvery = Math.ceil(pts.length / 5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {[0, 0.5, 1].map(t => (
        <line key={t}
          x1={PAD.l} y1={PAD.t + cH * (1 - t)}
          x2={PAD.l + cW} y2={PAD.t + cH * (1 - t)}
          stroke="#f3f4f6" strokeWidth="1"
        />
      ))}
      {/* Area fill */}
      <path d={areaD} fill="currentColor" fillOpacity="0.08" className="text-primary" />
      {/* Line */}
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      {/* Dots — only where jobs > 0 */}
      {pts.filter(p => p.jobs > 0).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="currentColor" className="text-primary" />
      ))}
      {/* X labels — anchor edges inward so first/last labels never clip */}
      {pts.filter((_, i) => i % showEvery === 0 || i === pts.length - 1).map((p, i, arr) => (
        <text
          key={i}
          x={p.x}
          y={H - 5}
          textAnchor={i === 0 && p.x < 30 ? 'start' : i === arr.length - 1 ? 'end' : 'middle'}
          fontSize="9"
          fill="#9ca3af"
        >
          {p.label}
        </text>
      ))}
    </svg>
  )
}

/* ── Donut chart ── */
const STATUS_CONFIG = [
  { key: 'completed',   label: 'Completed',   color: '#10b981' },
  { key: 'in_progress', label: 'In Progress',  color: '#3b82f6' },
  { key: 'pending',     label: 'Pending',      color: '#f59e0b' },
  { key: 'cancelled',   label: 'Cancelled',    color: '#ef4444' },
]

function DonutChart({ counts }: { counts: Record<string, number> }) {
  const total = STATUS_CONFIG.reduce((s, seg) => s + (counts[seg.key] ?? 0), 0)
  const R = 40, CIRC = 2 * Math.PI * R

  let cum = 0
  const arcs = STATUS_CONFIG.map(seg => {
    const val = counts[seg.key] ?? 0
    const pct = total > 0 ? val / total : 0
    const arc = { ...seg, val, pct, cum }
    cum += pct
    return arc
  })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width="100" height="100" className="shrink-0">
        {total === 0 ? (
          <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4f6" strokeWidth="13" />
        ) : (
          arcs.map(arc => arc.pct > 0 && (
            <circle key={arc.key}
              cx="50" cy="50" r={R} fill="none"
              stroke={arc.color} strokeWidth="13"
              strokeDasharray={`${arc.pct * CIRC} ${CIRC}`}
              strokeDashoffset={-arc.cum * CIRC}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}
            />
          ))
        )}
        <text x="50" y="47" textAnchor="middle" fontSize="17" fontWeight="700" fill="#111827">{total}</text>
        <text x="50" y="60" textAnchor="middle" fontSize="8" fill="#9ca3af">bookings</text>
      </svg>

      <div className="space-y-1.5 flex-1 min-w-0">
        {STATUS_CONFIG.map(seg => (
          <div key={seg.key} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-500 flex-1 truncate">{seg.label}</span>
            <span className="text-xs font-bold text-gray-900 tabular-nums">{counts[seg.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Horizontal bars ── */
function HorizBars({ items, emptyMsg }: {
  items: { label: string; value: number; formatted: string }[]
  emptyMsg: string
}) {
  const max = Math.max(...items.map(i => i.value), 1)
  if (items.length === 0) {
    return <p className="text-xs text-gray-400 italic mt-2">{emptyMsg}</p>
  }
  return (
    <div className="space-y-3 mt-1">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 truncate max-w-[60%]">{item.label}</span>
            <span className="text-xs font-semibold text-gray-900">{item.formatted}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div className="h-1.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Star rating ── */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
      ))}
    </div>
  )
}

/* ── Stat card ── */
function StatCard({ label, display, icon, iconBg, sub, progress, stars, rating }: {
  label: string; display: string; icon: React.ReactNode; iconBg: string
  sub?: string; progress?: number | null; stars?: boolean; rating?: number
}) {
  const empty = display === '—'
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 leading-none">{label}</p>
        <div className={`rounded-lg p-1.5 ${iconBg}`}>{icon}</div>
      </div>
      {empty
        ? <p className="text-sm font-semibold text-gray-300">Not enough data</p>
        : <p className="text-2xl font-bold tracking-tight text-gray-900">{display}</p>
      }
      {stars && !empty && rating !== undefined && <StarRating rating={rating} />}
      {progress != null && !empty && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {sub && <p className="mt-1.5 text-[11px] text-gray-400 leading-tight">{sub}</p>}
    </div>
  )
}

/* ── Main page ── */
export default function ProviderAnalyticsPage() {
  const { providerId } = useProfileIds()
  const [bookings, setBookings] = useState<any[]>([])
  const [profile, setProfile] = useState<{ rating_average: number; total_reviews: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!providerId) return
    Promise.all([
      supabase.from('bookings')
        .select('id, status, total_amount, base_amount, scheduled_date, created_at, service:services(title), customer_profile:customer_profiles(first_name, last_name)')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false }),
      supabase.from('provider_profiles').select('rating_average, total_reviews').eq('id', providerId).maybeSingle(),
    ]).then(([{ data: b }, { data: p }]) => {
      setBookings(b ?? [])
      setProfile(p)
      setLoading(false)
    })
  }, [providerId])

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const completed   = bookings.filter(b => b.status === 'completed')
  const cancelled   = bookings.filter(b => b.status === 'cancelled')
  const inProgress  = bookings.filter(b => b.status === 'in_progress')
  const pending     = bookings.filter(b => b.status === 'pending')
  const totalRev    = completed.reduce((s, b) => s + (b.base_amount ?? b.total_amount ?? 0), 0)
  const completion  = bookings.length > 0 ? Math.round((completed.length / bookings.length) * 100) : 0
  const cancelRate  = bookings.length > 0 ? Math.round((cancelled.length / bookings.length) * 100) : 0
  const avgJobVal   = completed.length > 0 ? Math.round(totalRev / completed.length) : 0
  const avgRating   = Number(profile?.rating_average ?? 0)
  const reviewCount = profile?.total_reviews ?? 0

  const thisMonthJobs = bookings.filter(b => (b.scheduled_date ?? '') >= monthStart).length
  const thisMonthRev  = completed
    .filter(b => (b.scheduled_date ?? '') >= monthStart)
    .reduce((s, b) => s + (b.base_amount ?? b.total_amount ?? 0), 0)

  const statusCounts = {
    completed:   completed.length,
    in_progress: inProgress.length,
    pending:     pending.length,
    cancelled:   cancelled.length,
  }

  // Last 12 weeks for line chart
  const weeks = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const start = new Date(now)
    start.setDate(start.getDate() - (11 - i) * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    const label = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    const jobs = bookings.filter(b => {
      if (!b.scheduled_date) return false
      const d = new Date(b.scheduled_date + 'T00:00:00')
      return d >= start && d <= end
    }).length
    return { label, jobs }
  }), [bookings])

  // Revenue by service type
  const byService = useMemo(() => {
    const map = new Map<string, number>()
    completed.forEach(b => {
      const title = b.service?.title ?? 'Other'
      map.set(title, (map.get(title) ?? 0) + (b.base_amount ?? b.total_amount ?? 0))
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, formatted: formatCurrency(value / 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [completed])

  function customerName(b: any) {
    const cp = b.customer_profile
    return cp ? `${titleCase(cp.first_name ?? '')} ${titleCase(cp.last_name ?? '')}`.trim() || 'Customer' : 'Customer'
  }
  function fmtDate(s: string) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(s + 'T12:00:00'))
  }

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-400">Performance overview for your provider account</p>
      </div>

      {/* ── Top 3-panel row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px_220px]">

        {/* Line chart */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Bookings Over Time</p>
              <p className="text-xs text-gray-400 mt-0.5">All bookings · last 12 weeks</p>
            </div>
            <span className="text-3xl font-bold text-gray-900">{bookings.length}</span>
          </div>
          <LineChart data={weeks} />
        </div>

        {/* Donut */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm font-bold text-gray-900 mb-4">Bookings by Status</p>
          <DonutChart counts={statusCounts} />
        </div>

        {/* Horiz bars */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm font-bold text-gray-900">Revenue by Service</p>
          <HorizBars items={byService} emptyMsg="Complete jobs to see breakdown" />
        </div>
      </div>

      {/* ── Stat row 1 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Bookings" display={bookings.length.toString()}
          icon={<Briefcase size={13} />} iconBg="bg-primary/[0.08] text-primary"
          sub={`${cancelled.length} cancelled`} />
        <StatCard label="Completed" display={completed.length.toString()}
          icon={<CheckCircle size={13} />} iconBg="bg-green-50 text-green-600"
          sub={`${inProgress.length} in progress`} />
        <StatCard label="Completion Rate" display={bookings.length > 0 ? `${completion}%` : '—'}
          icon={<TrendingUp size={13} />} iconBg="bg-purple-50 text-purple-600"
          progress={bookings.length > 0 ? completion : null}
          sub={bookings.length === 0 ? 'Complete a booking to see this' : `${100 - completion}% incomplete`} />
        <StatCard label="Total Revenue" display={completed.length > 0 ? formatCurrency(totalRev / 100) : '—'}
          icon={<PoundSterling size={13} />} iconBg="bg-emerald-50 text-emerald-600"
          sub={completed.length > 0 ? `avg ${formatCurrency(avgJobVal / 100)} / job` : 'Earn from completed jobs'} />
        <StatCard label="Avg Rating" display={avgRating > 0 ? avgRating.toFixed(1) : '—'}
          icon={<Star size={13} />} iconBg="bg-amber-50 text-amber-500"
          stars={avgRating > 0} rating={avgRating}
          sub={avgRating > 0 ? `${reviewCount} review${reviewCount !== 1 ? 's' : ''}` : 'Complete a job to earn reviews'} />
      </div>

      {/* ── Stat row 2 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="This Month" display={thisMonthJobs.toString()}
          icon={<Briefcase size={13} />} iconBg="bg-sky-50 text-sky-600"
          sub="bookings this month" />
        <StatCard label="Month Revenue" display={thisMonthRev > 0 ? formatCurrency(thisMonthRev / 100) : '—'}
          icon={<PoundSterling size={13} />} iconBg="bg-teal-50 text-teal-600"
          sub={thisMonthRev > 0 ? 'net this month' : 'No completed jobs yet'} />
        <StatCard label="Avg Job Value" display={avgJobVal > 0 ? formatCurrency(avgJobVal / 100) : '—'}
          icon={<PoundSterling size={13} />} iconBg="bg-indigo-50 text-indigo-600"
          sub={avgJobVal > 0 ? 'per completed job' : 'Not enough data yet'} />
        <StatCard label="Cancellation Rate" display={bookings.length > 0 ? `${cancelRate}%` : '—'}
          icon={<TrendingUp size={13} />} iconBg="bg-rose-50 text-rose-500"
          sub={bookings.length > 0 ? `${cancelled.length} cancelled` : 'Not enough data yet'} />
        <StatCard label="Total Reviews" display={reviewCount.toString()}
          icon={<MessageSquare size={13} />} iconBg="bg-pink-50 text-pink-600"
          sub={reviewCount > 0 ? `based on ${reviewCount} review${reviewCount !== 1 ? 's' : ''}` : 'No reviews yet'} />
      </div>

      {/* ── Bottom tables ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Recent Completed */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <p className="text-sm font-bold text-gray-900">Recent Completed</p>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">{completed.length}</span>
          </div>
          {completed.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-gray-400">No completed jobs yet</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_72px_72px] gap-x-3 border-b border-gray-50 px-5 py-2">
                {['Service', 'Date', 'Amount'].map(h => (
                  <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 last:text-right">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-gray-50">
                {completed.slice(0, 6).map(b => (
                  <Link key={b.id} href={`/provider/bookings/${b.id}`}
                    className="grid grid-cols-[1fr_72px_72px] gap-x-3 items-center px-5 py-3 hover:bg-gray-50/60 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{b.service?.title ?? 'Job'}</p>
                      <p className="truncate text-xs text-gray-400">{customerName(b)}</p>
                    </div>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{b.scheduled_date ? fmtDate(b.scheduled_date) : '—'}</p>
                    <p className="text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                      {formatCurrency((b.base_amount ?? b.total_amount ?? 0) / 100)}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <p className="text-sm font-bold text-gray-900">Recent Activity</p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{bookings.length}</span>
          </div>
          {bookings.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-gray-400">No bookings yet</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_64px_80px] gap-x-3 border-b border-gray-50 px-5 py-2">
                {['Service', 'Date', 'Status'].map(h => (
                  <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 last:text-right">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-gray-50">
                {bookings.slice(0, 6).map(b => (
                  <Link key={b.id} href={`/provider/bookings/${b.id}`}
                    className="grid grid-cols-[1fr_64px_80px] gap-x-3 items-center px-5 py-3 hover:bg-gray-50/60 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{b.service?.title ?? 'Job'}</p>
                      <p className="truncate text-xs text-gray-400">{customerName(b)}</p>
                    </div>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{b.scheduled_date ? fmtDate(b.scheduled_date) : '—'}</p>
                    <div className="flex justify-end">
                      <StatusBadge status={b.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
