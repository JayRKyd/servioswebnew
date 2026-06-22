'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatTime } from '@/lib/utils'
import { MapPin, Clock, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function firstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_HEADERS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

interface MonthEvent {
  id: string
  scheduled_date: string
  scheduled_time_start: string | null
  service_title: string
}

export default function ProviderCalendarPage() {
  const { providerId } = useProfileIds()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [monthEvents, setMonthEvents] = useState<MonthEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<any[]>([])
  const [loadingDay, setLoadingDay] = useState(false)

  const eventMap = new Map<string, MonthEvent[]>()
  for (const e of monthEvents) {
    const arr = eventMap.get(e.scheduled_date) ?? []
    arr.push(e)
    eventMap.set(e.scheduled_date, arr)
  }

  useEffect(() => {
    if (!providerId) return
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    supabase.from('bookings')
      .select('id, scheduled_date, scheduled_time_start, service:services(title)')
      .eq('provider_id', providerId)
      .gte('scheduled_date', from).lte('scheduled_date', to)
      .in('status', ['accepted', 'in_progress'])
      .order('scheduled_time_start')
      .then(({ data }) => {
        setMonthEvents((data ?? []).map((b: any) => ({
          id: b.id,
          scheduled_date: b.scheduled_date,
          scheduled_time_start: b.scheduled_time_start,
          service_title: b.service?.title ?? 'Job',
        })))
      })
  }, [providerId, year, month])

  async function selectDay(dateStr: string) {
    if (!providerId) return
    setSelectedDate(dateStr)
    setLoadingDay(true)
    const { data } = await supabase.from('bookings')
      .select('id, scheduled_time_start, service_address, service:services(title), customer_profile:customer_profiles(first_name, last_name, profile_image_url)')
      .eq('provider_id', providerId)
      .eq('scheduled_date', dateStr)
      .in('status', ['accepted', 'in_progress'])
      .order('scheduled_time_start')
    setSelectedBookings(data ?? [])
    setLoadingDay(false)
  }

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const todayStr = now.toISOString().split('T')[0]
  const trailingCount = (firstDay + days) % 7 === 0 ? 0 : 7 - ((firstDay + days) % 7)

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
    setSelectedDate(todayStr)
    selectDay(todayStr)
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button onClick={prevMonth} className="flex items-center justify-center px-3 py-2 hover:bg-gray-50 transition-colors border-r border-gray-200">
              <ChevronLeft size={16} className="text-gray-500" />
            </button>
            <button onClick={nextMonth} className="flex items-center justify-center px-3 py-2 hover:bg-gray-50 transition-colors">
              <ChevronRight size={16} className="text-gray-500" />
            </button>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            {MONTHS[month]} <span className="text-gray-400 font-normal">{year}</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-sm bg-primary" />
            <span>Booked job</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* ── Calendar grid ── */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/60">
            {DAY_HEADERS.map((d, i) => (
              <div
                key={d}
                className={`py-3 text-center text-xs font-semibold uppercase tracking-widest ${
                  i === 0 || i === 6 ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Cell grid */}
          <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-gray-100/80">

            {/* Leading blanks */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={'pre' + i} className="bg-gray-50/40 p-2" />
            ))}

            {/* Day cells */}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const colIndex = (firstDay + i) % 7
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const events = eventMap.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const isWeekend = colIndex === 0 || colIndex === 6

              return (
                <button
                  key={day}
                  onClick={() => selectDay(dateStr)}
                  className={[
                    'flex flex-col items-start p-2 text-left transition-colors group focus:outline-none',
                    isSelected
                      ? 'bg-primary/[0.06] ring-inset ring-2 ring-primary/40'
                      : isWeekend
                      ? 'bg-gray-50/50 hover:bg-gray-100/60'
                      : 'bg-white hover:bg-blue-50/40',
                  ].join(' ')}
                >
                  {/* Day number */}
                  <span
                    className={[
                      'mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                      isToday
                        ? 'bg-primary text-white'
                        : isSelected
                        ? 'text-primary font-semibold'
                        : isWeekend
                        ? 'text-gray-400'
                        : 'text-gray-700 group-hover:text-gray-900',
                    ].join(' ')}
                  >
                    {day}
                  </span>

                  {/* Event pills */}
                  <div className="flex w-full flex-col gap-0.5">
                    {events.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className="flex min-w-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-[3px]"
                      >
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="truncate text-[10px] font-medium text-primary leading-tight">
                          {ev.scheduled_time_start ? formatTime(ev.scheduled_time_start) + ' · ' : ''}
                          {ev.service_title}
                        </span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <span className="pl-1 text-[10px] text-gray-400">+{events.length - 3} more</span>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Trailing blanks */}
            {Array.from({ length: trailingCount }).map((_, i) => (
              <div key={'post' + i} className="bg-gray-50/40 p-2" />
            ))}
          </div>
        </div>

        {/* ── Day panel ── */}
        <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
          {selectedDate ? (
            <>
              {/* Panel header */}
              <div className="border-b border-gray-100 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date(selectedDate + 'T12:00:00'))}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-gray-900">
                  {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(selectedDate + 'T12:00:00'))}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {loadingDay ? '…' : `${selectedBookings.length} booking${selectedBookings.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Booking list */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingDay ? (
                  <div className="flex h-28 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : selectedBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <CalendarDays size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400">No bookings on this day</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedBookings.map(b => {
                      const cp = b.customer_profile
                      const initials = cp
                        ? `${cp.first_name?.[0] ?? ''}${cp.last_name?.[0] ?? ''}`.toUpperCase()
                        : '?'
                      const customerName = cp
                        ? `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim()
                        : 'Customer'
                      return (
                        <Link
                          key={b.id}
                          href={`/provider/bookings/${b.id}`}
                          className="group flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-primary/30 hover:bg-primary/[0.04]"
                        >
                          {/* Avatar */}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-white">
                            {cp?.profile_image_url
                              ? <img src={cp.profile_image_url} alt="" className="h-9 w-9 object-cover" />
                              : initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">{b.service?.title ?? 'Job'}</p>
                            <p className="truncate text-xs text-gray-500">{customerName}</p>
                            {b.scheduled_time_start && (
                              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                                <Clock size={10} />
                                {formatTime(b.scheduled_time_start)}
                              </p>
                            )}
                            {b.service_address && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-400">
                                <MapPin size={10} />
                                {typeof b.service_address === 'string'
                                  ? b.service_address
                                  : b.service_address?.line1 ?? ''}
                              </p>
                            )}
                          </div>

                          <ChevronRight
                            size={14}
                            className="mt-1 shrink-0 text-gray-200 transition-colors group-hover:text-primary"
                          />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="rounded-2xl bg-gray-50 p-5">
                <CalendarDays size={32} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600">Select a day</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Click any date on the calendar to see your bookings for that day.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
