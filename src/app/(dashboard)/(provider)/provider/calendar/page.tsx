'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatTime } from '@/lib/utils'
import { MapPin, Clock, ChevronRight } from 'lucide-react'

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function firstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ProviderCalendarPage() {
  const { providerId } = useProfileIds()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookedDates, setBookedDates] = useState<Map<string, number>>(new Map())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedBookings, setSelectedBookings] = useState<any[]>([])
  const [loadingDay, setLoadingDay] = useState(false)

  useEffect(() => {
    if (!providerId) return
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    supabase.from('bookings').select('scheduled_date, id').eq('provider_id', providerId)
      .gte('scheduled_date', from).lte('scheduled_date', to)
      .in('status', ['accepted', 'in_progress'])
      .then(({ data }) => {
        const counts = new Map<string, number>()
        for (const b of data ?? []) {
          counts.set(b.scheduled_date, (counts.get(b.scheduled_date) ?? 0) + 1)
        }
        setBookedDates(counts)
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
    setSelectedBookings(data ?? [])
    setLoadingDay(false)
  }

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const todayStr = now.toISOString().split('T')[0]

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const selectedLabel = selectedDate
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(selectedDate))
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Calendar grid */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100">←</button>
            <span className="font-semibold text-gray-900">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100">→</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="py-1 text-xs font-medium text-gray-400">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1
              const dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')
              const count = bookedDates.get(dateStr) ?? 0
              const isBooked = count > 0
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              return (
                <button
                  key={day}
                  onClick={() => selectDay(dateStr)}
                  className={
                    'relative flex h-9 w-full items-center justify-center rounded-lg text-sm cursor-pointer transition ' +
                    (isSelected ? 'bg-primary ring-2 ring-offset-1 ring-primary font-semibold text-white' :
                      isBooked ? 'bg-primary font-semibold text-white hover:opacity-90' :
                        isToday ? 'ring-2 ring-blue-600 font-semibold text-primary hover:bg-blue-50' :
                          'text-gray-700 hover:bg-gray-50')
                  }
                >
                  {day}
                  {count > 1 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-primary ring-1 ring-primary">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-primary" /> Booked</div>
            <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full ring-2 ring-blue-600" /> Today</div>
          </div>
        </div>

        {/* Day panel */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          {selectedDate ? (
            <>
              <h2 className="mb-4 font-semibold text-gray-900">{selectedLabel}</h2>
              {loadingDay ? (
                <div className="flex h-24 items-center justify-center text-gray-400 text-sm">Loading…</div>
              ) : selectedBookings.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-gray-400 text-sm">No jobs on this day</div>
              ) : (
                <div className="space-y-3">
                  {selectedBookings.map(b => {
                    const cp = b.customer_profile
                    const initials = cp ? `${cp.first_name?.[0] ?? ''}${cp.last_name?.[0] ?? ''}`.toUpperCase() : '?'
                    const customerName = cp ? `${cp.first_name ?? ''} ${cp.last_name ?? ''}`.trim() : 'Customer'
                    return (
                      <Link
                        key={b.id}
                        href={`/provider/bookings/${b.id}`}
                        className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/30"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                          {cp?.profile_image_url
                            ? <img src={cp.profile_image_url} alt="" className="h-9 w-9 object-cover" />
                            : initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{b.service?.title ?? 'Job'}</p>
                          <p className="text-xs text-gray-500 truncate">{customerName}</p>
                          {b.scheduled_time_start && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                              <Clock size={10} /> {formatTime(b.scheduled_time_start)}
                            </p>
                          )}
                          {b.service_address && (
                            <p className="flex items-center gap-1 text-xs text-gray-400 truncate">
                              <MapPin size={10} /> {typeof b.service_address === 'string' ? b.service_address : b.service_address?.line1 ?? ''}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="shrink-0 text-gray-300 mt-1" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center text-gray-400 text-sm">
              Select a day to see jobs
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
