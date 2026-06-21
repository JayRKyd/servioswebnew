'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { Plus, X } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const TIME_SLOTS: string[] = []
for (let h = 6; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
  breakEnabled: boolean
  breakStart: string
  breakEnd: string
}
type WeekSchedule = Record<string, DaySchedule>

const DEFAULT: WeekSchedule = Object.fromEntries(
  DAY_KEYS.map(d => [d, {
    enabled: !['saturday', 'sunday'].includes(d),
    start: '09:00', end: '17:00',
    breakEnabled: false, breakStart: '12:00', breakEnd: '13:00',
  }])
)

const BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT)
  const [emergency, setEmergency] = useState(false)
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('provider_availability')
        .select('*')
        .eq('provider_id', user.id)
        .single()

      if (data) {
        const loaded: WeekSchedule = {}
        for (const key of DAY_KEYS) {
          loaded[key] = {
            enabled: data[`${key}_enabled`] ?? DEFAULT[key].enabled,
            start: data[`${key}_start`] ?? '09:00',
            end: data[`${key}_end`] ?? '17:00',
            breakEnabled: !!(data[`${key}_break_start`]),
            breakStart: data[`${key}_break_start`] ?? '12:00',
            breakEnd: data[`${key}_break_end`] ?? '13:00',
          }
        }
        setSchedule(loaded)
        setEmergency(data.emergency_available ?? false)
        setBufferMinutes(data.buffer_minutes ?? 0)
        setBlockedDates(data.blocked_dates ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggle(key: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))
  }
  function setTime(key: string, field: 'start' | 'end' | 'breakStart' | 'breakEnd', val: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], [field]: val } }))
  }
  function toggleBreak(key: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], breakEnabled: !p[key].breakEnabled } }))
  }

  function addBlockedDate() {
    if (!newBlockedDate || blockedDates.includes(newBlockedDate)) return
    setBlockedDates(d => [...d, newBlockedDate].sort())
    setNewBlockedDate('')
  }
  function removeBlockedDate(date: string) {
    setBlockedDates(d => d.filter(x => x !== date))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const payload: Record<string, unknown> = {
        provider_id: user.id,
        emergency_available: emergency,
        buffer_minutes: bufferMinutes,
        blocked_dates: blockedDates,
        updated_at: new Date().toISOString(),
      }
      for (const key of DAY_KEYS) {
        payload[`${key}_enabled`] = schedule[key].enabled
        payload[`${key}_start`] = schedule[key].start
        payload[`${key}_end`] = schedule[key].end
        payload[`${key}_break_start`] = schedule[key].breakEnabled ? schedule[key].breakStart : null
        payload[`${key}_break_end`] = schedule[key].breakEnabled ? schedule[key].breakEnd : null
      }
      await supabase.from('provider_availability').upsert(payload, { onConflict: 'provider_id' })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = DAY_KEYS.filter(k => schedule[k].enabled).length

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="text-sm text-gray-500 mt-1">
            Set your working hours. Customers can only book you during these times.
            {enabledCount > 0 && ` Available ${enabledCount} day${enabledCount !== 1 ? 's' : ''} a week.`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Emergency toggle */}
      <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-orange-900">Emergency Available</p>
          <p className="text-sm text-orange-700 mt-0.5">Accept emergency jobs outside normal hours. 15% commission applies.</p>
        </div>
        <button
          onClick={() => setEmergency(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emergency ? 'bg-red-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emergency ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Buffer between bookings */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Buffer between bookings</label>
        <p className="text-xs text-gray-500 mb-3">Time blocked after each job to travel, clean up, or rest.</p>
        <div className="flex gap-2">
          {BUFFER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setBufferMinutes(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                bufferMinutes === opt.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day schedules */}
      <div className="space-y-3">
        {DAY_KEYS.map((key, i) => {
          const day = schedule[key]
          return (
            <div key={key} className={`rounded-2xl border p-4 transition-colors ${day.enabled ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${day.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{DAYS[i]}</span>
                <button
                  onClick={() => toggle(key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${day.enabled ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${day.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {day.enabled ? (
                <div className="mt-3 space-y-3">
                  {/* Working hours */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <select
                        value={day.start}
                        onChange={e => setTime(key, 'start', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 mt-5">–</span>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Until</label>
                      <select
                        value={day.end}
                        onChange={e => setTime(key, 'end', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Break toggle */}
                  <div>
                    <button
                      onClick={() => toggleBreak(key)}
                      className="text-xs text-primary hover:underline"
                    >
                      {day.breakEnabled ? 'Remove lunch break' : '+ Add lunch break'}
                    </button>
                    {day.breakEnabled && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Break from</label>
                          <select
                            value={day.breakStart}
                            onChange={e => setTime(key, 'breakStart', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <span className="text-gray-400 mt-5">–</span>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 mb-1">Until</label>
                          <select
                            value={day.breakEnd}
                            onChange={e => setTime(key, 'breakEnd', e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-1">Unavailable</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Blocked dates */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Blocked dates</p>
          <p className="text-xs text-gray-500 mt-0.5">Dates you are unavailable, e.g. bank holidays or holidays.</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={newBlockedDate}
            onChange={e => setNewBlockedDate(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={addBlockedDate}
            disabled={!newBlockedDate}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {blockedDates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {blockedDates.map(d => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))}
                <button onClick={() => removeBlockedDate(d)} className="text-gray-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? 'Changes Saved' : 'Save Availability'}
      </button>
    </div>
  )
}
