'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function firstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ProviderCalendarPage() {
  const { providerId } = useProfileIds()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!providerId) return
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    supabase.from('bookings').select('scheduled_date').eq('provider_id', providerId)
      .gte('scheduled_date', from).lte('scheduled_date', to)
      .in('status', ['accepted', 'in_progress'])
      .then(({ data }) => setBookedDates(new Set((data ?? []).map((b: any) => b.scheduled_date))))
  }, [providerId, year, month])

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const todayStr = now.toISOString().split('T')[0]

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>

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
            const isBooked = bookedDates.has(dateStr)
            const isToday = dateStr === todayStr
            return (
              <div key={day} className={'flex h-9 w-full items-center justify-center rounded-lg text-sm ' + (isBooked ? 'bg-primary font-semibold text-white' : isToday ? 'ring-2 ring-blue-600 font-semibold text-primary' : 'text-gray-700 hover:bg-gray-50')}>
                {day}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full bg-primary" /> Booked</div>
          <div className="flex items-center gap-1"><div className="h-3 w-3 rounded-full ring-2 ring-blue-600" /> Today</div>
        </div>
      </div>
    </div>
  )
}
