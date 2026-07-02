'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { Plus, X, Zap, Clock, CalendarOff, CheckCircle } from 'lucide-react'
import { UKDateInput } from '@/components/shared/UKDateInput'

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const KEYS  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

const TIME_SLOTS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
  if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
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
  KEYS.map(d => [d, {
    enabled: !['saturday','sunday'].includes(d),
    start: '09:00', end: '17:00',
    breakEnabled: false, breakStart: '12:00', breakEnd: '13:00',
  }])
)

const BUFFER_OPTIONS = [
  { value: 0,  label: 'None' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[90px]">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function AvailabilityPage() {
  const { user } = useAuth()
  const [schedule,       setSchedule]       = useState<WeekSchedule>(DEFAULT)
  const [emergency,      setEmergency]      = useState(false)
  const [bufferMinutes,  setBufferMinutes]  = useState(0)
  const [blockedDates,   setBlockedDates]   = useState<string[]>([])
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_availability').select('*').eq('provider_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const loaded: WeekSchedule = {}
          for (const key of KEYS) {
            loaded[key] = {
              enabled:      data[`${key}_enabled`] ?? DEFAULT[key].enabled,
              start:        data[`${key}_start`]   ?? '09:00',
              end:          data[`${key}_end`]     ?? '17:00',
              breakEnabled: !!(data[`${key}_break_start`]),
              breakStart:   data[`${key}_break_start`] ?? '12:00',
              breakEnd:     data[`${key}_break_end`]   ?? '13:00',
            }
          }
          setSchedule(loaded)
          setEmergency(data.emergency_available ?? false)
          setBufferMinutes(data.buffer_minutes ?? 0)
          setBlockedDates(data.blocked_dates ?? [])
        }
        setLoading(false)
      })
  }, [user?.id])

  function toggle(key: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))
  }
  function setTime(key: string, field: 'start'|'end'|'breakStart'|'breakEnd', val: string) {
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
    if (!user) return
    setSaving(true); setSaved(false)
    const payload: Record<string, unknown> = {
      provider_id: user.id,
      emergency_available: emergency,
      buffer_minutes: bufferMinutes,
      blocked_dates: blockedDates,
      updated_at: new Date().toISOString(),
    }
    for (const key of KEYS) {
      payload[`${key}_enabled`]     = schedule[key].enabled
      payload[`${key}_start`]       = schedule[key].start
      payload[`${key}_end`]         = schedule[key].end
      payload[`${key}_break_start`] = schedule[key].breakEnabled ? schedule[key].breakStart : null
      payload[`${key}_break_end`]   = schedule[key].breakEnabled ? schedule[key].breakEnd   : null
    }
    await supabase.from('provider_availability').upsert(payload, { onConflict: 'provider_id' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const enabledKeys  = KEYS.filter(k => schedule[k].enabled)
  const enabledCount = enabledKeys.length
  const workingDayNames = enabledKeys.map(k => DAYS[KEYS.indexOf(k)].slice(0, 3)).join(', ')

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {enabledCount === 0
              ? 'No working days set — customers cannot book you.'
              : `Working ${enabledCount} day${enabledCount !== 1 ? 's' : ''} a week · ${workingDayNames}`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all ${
            saved ? 'bg-green-600' : 'bg-primary hover:bg-primary/90'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>

      {/* ── Settings strip ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Emergency Available */}
        <div className={`flex items-start justify-between gap-4 rounded-2xl border p-4 transition-colors ${
          emergency ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`rounded-xl p-2 shrink-0 ${emergency ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Zap size={15} className={emergency ? 'text-red-600' : 'text-gray-400'} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${emergency ? 'text-red-900' : 'text-gray-800'}`}>
                Emergency Available
              </p>
              <p className={`mt-0.5 text-xs leading-relaxed ${emergency ? 'text-red-600' : 'text-gray-400'}`}>
                Accept urgent jobs outside working hours.<br />15% platform commission applies.
              </p>
            </div>
          </div>
          <Toggle on={emergency} onToggle={() => setEmergency(v => !v)} />
        </div>

        {/* Buffer between bookings */}
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-100 p-2 shrink-0">
              <Clock size={15} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Buffer between bookings</p>
              <p className="mt-0.5 text-xs text-gray-400">Time blocked after each job to travel or rest.</p>
            </div>
          </div>
          <div className="flex gap-2 pl-11">
            {BUFFER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBufferMinutes(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
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
      </div>

      {/* ── Weekly schedule ── */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-bold text-gray-900">Weekly Schedule</h2>
          <p className="mt-0.5 text-xs text-gray-400">Toggle days on/off and set working hours. Add a lunch break per day if needed.</p>
        </div>

        <div className="divide-y divide-gray-50">
          {KEYS.map((key, i) => {
            const day = schedule[key]
            const isWeekend = key === 'saturday' || key === 'sunday'
            return (
              <div key={key} className={`transition-colors ${day.enabled ? 'bg-white' : 'bg-gray-50/40'}`}>

                {/* Day row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">

                  {/* Day name + toggle */}
                  <div className="flex w-28 shrink-0 items-center gap-3">
                    <Toggle on={day.enabled} onToggle={() => toggle(key)} />
                    <span className={`text-sm font-semibold ${day.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                      {DAYS[i]}
                    </span>
                  </div>

                  {day.enabled ? (
                    <>
                      {/* Hours */}
                      <div className="flex items-end gap-2.5">
                        <TimeSelect value={day.start} onChange={v => setTime(key,'start',v)} label="From" />
                        <span className="mb-1.5 text-gray-400 text-sm">—</span>
                        <TimeSelect value={day.end} onChange={v => setTime(key,'end',v)} label="Until" />
                      </div>

                      {/* Break toggle */}
                      <button
                        type="button"
                        onClick={() => toggleBreak(key)}
                        className={`ml-auto text-xs font-medium transition-colors ${
                          day.breakEnabled
                            ? 'text-red-400 hover:text-red-600'
                            : 'text-primary hover:text-primary/70'
                        }`}
                      >
                        {day.breakEnabled ? '− Remove break' : '+ Add lunch break'}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not working</span>
                  )}
                </div>

                {/* Break row */}
                {day.enabled && day.breakEnabled && (
                  <div className="flex items-end gap-2.5 border-t border-dashed border-gray-100 bg-amber-50/50 px-5 py-3">
                    <span className="mb-1.5 text-xs font-semibold text-amber-600 w-28 shrink-0">Lunch break</span>
                    <TimeSelect value={day.breakStart} onChange={v => setTime(key,'breakStart',v)} label="From" />
                    <span className="mb-1.5 text-gray-400 text-sm">—</span>
                    <TimeSelect value={day.breakEnd} onChange={v => setTime(key,'breakEnd',v)} label="Until" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Blocked dates ── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2 shrink-0">
            <CalendarOff size={15} className="text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Date Overrides</p>
            <p className="text-xs text-gray-400 mt-0.5">Block specific dates — bank holidays, vacation, personal days.</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex gap-2">
            <UKDateInput
              value={newBlockedDate}
              onChange={setNewBlockedDate}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={addBlockedDate}
              disabled={!newBlockedDate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <Plus size={14} /> Block date
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">No dates blocked</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedDates.map(d => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                  {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00'))}
                  <button
                    type="button"
                    onClick={() => removeBlockedDate(d)}
                    className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-all ${
          saved ? 'bg-green-600' : 'bg-primary hover:bg-primary/90'
        } disabled:opacity-50`}
      >
        {saving ? 'Saving…' : saved ? 'Changes Saved' : 'Save Availability'}
      </button>
    </div>
  )
}
