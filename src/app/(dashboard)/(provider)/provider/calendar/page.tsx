'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function firstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }
function fmtTime(t: string | null) { if (!t) return null; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}` }
function fmtDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_COLORS: Record<string, string> = {
  accepted: 'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}

export default function ProviderCalendarPage() {
  const { providerId } = useProfileIds()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayBookings, setDayBookings] = useState<any[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  useEffect(() => {
    if (!providerId) return
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    supabase.from('bookings')
      .select('scheduled_date')
      .eq('provider_id', providerId)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .in('status', ['pending', 'accepted', 'in_progress'])
      .then(({ data }) => setBookedDates(new Set((data ?? []).map((b: any) => b.scheduled_date))))
  }, [providerId, year, month])

  async function handleDayClick(dateStr: string) {
    if (!bookedDates.has(dateStr)) return
    if (selectedDate === dateStr) { setSelectedDate(null); return }
    setSelectedDate(dateStr)
    setDayLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('id, booking_number, status, scheduled_time_start, base_amount, total_amount, service:services(title), customer_profile:customer_profiles(first_name, last_name)')
      .eq('provider_id', providerId!)
      .eq('scheduled_date', dateStr)
      .in('status', ['pending', 'accepted', 'in_progress'])
      .order('scheduled_time_start', { ascending: true })
    setDayBookings(data ?? [])
    setDayLoading(false)
  }

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const todayStr = now.toISOString().split('T')[0]

  function prevMonth() {
    setSelectedDate(null)
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    setSelectedDate(null)
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
        {/* Calendar grid */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100 text-gray-600">←</button>
            <span className="font-semibold text-gray-900">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100 text-gray-600">→</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-1 text-xs font-medium text-gray-400">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
              const isBooked = bookedDates.has(dateStr)
              const isToday = dateStr === todayStr
              const isSelected = selectedDate === dateStr
              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(dateStr)}
                  disabled={!isBooked}
                  className={[
                    'flex h-10 w-full flex-col items-center justify-center rounded-lg text-sm transition-colors',
                    isSelected
                      ? 'bg-primary ring-2 ring-primary ring-offset-2 font-semibold text-white'
                      : isBooked
                      ? 'bg-primary font-semibold text-white hover:opacity-80 cursor-pointer'
                      : isToday
                      ? 'ring-2 ring-primary font-semibold text-primary'
                      : 'text-gray-700 hover:bg-gray-50 cursor-default',
                  ].join(' ')}
                >
                  {day}
                  {isBooked && <span className="mt-0.5 h-1 w-1 rounded-full bg-white/60" />}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full bg-primary" /> Booked</div>
            <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-full ring-2 ring-primary" /> Today</div>
          </div>
        </div>

        {/* Day detail panel */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <div className="text-3xl">📅</div>
              <p className="text-sm font-medium text-gray-700">Select a booked day</p>
              <p className="text-xs text-gray-400">Click any highlighted date to see your jobs for that day.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-5 py-4">
                <p className="text-sm font-semibold text-gray-900">{fmtDateLabel(selectedDate)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{dayBookings.length} job{dayBookings.length !== 1 ? 's' : ''} scheduled</p>
              </div>

              {dayLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : dayBookings.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">No active bookings found for this day.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {dayBookings.map((b: any) => {
                    const amount = (b.base_amount ?? b.total_amount ?? 0) / 100
                    const customer = b.customer_profile
                    return (
                      <li key={b.id}>
                        <Link
                          href={`/provider/bookings/${b.id}`}
                          className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                        >
                          {/* Time bubble */}
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                            {b.scheduled_time_start ? (
                              <>
                                <span className="text-[11px] font-bold leading-none">{fmtTime(b.scheduled_time_start)?.split(' ')[0]}</span>
                                <span className="text-[9px] leading-none">{fmtTime(b.scheduled_time_start)?.split(' ')[1]}</span>
                              </>
                            ) : (
                              <span className="text-xs">TBD</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {b.service?.title ?? `Job #${b.booking_number}`}
                            </p>
                            {customer && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {customer.first_name} {customer.last_name}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_COLORS[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {b.status.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">£{amount.toFixed(2)}</span>
                            </div>
                          </div>

                          <svg className="h-4 w-4 shrink-0 text-gray-300 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
