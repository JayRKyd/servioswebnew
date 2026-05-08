'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const TIME_SLOTS: string[] = []
for (let h = 6; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

interface DaySchedule { enabled: boolean; start: string; end: string }
type WeekSchedule = Record<string, DaySchedule>

const DEFAULT: WeekSchedule = Object.fromEntries(
  DAY_KEYS.map(d => [d, { enabled: !['saturday', 'sunday'].includes(d), start: '09:00', end: '17:00' }])
)

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT)
  const [emergency, setEmergency] = useState(false)
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
          }
        }
        setSchedule(loaded)
        setEmergency(data.emergency_available ?? false)
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggle(key: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))
  }
  function setTime(key: string, field: 'start' | 'end', val: string) {
    setSchedule(p => ({ ...p, [key]: { ...p[key], [field]: val } }))
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
        updated_at: new Date().toISOString(),
      }
      for (const key of DAY_KEYS) {
        payload[`${key}_enabled`] = schedule[key].enabled
        payload[`${key}_start`] = schedule[key].start
        payload[`${key}_end`] = schedule[key].end
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
    <div className="max-w-2xl mx-auto space-y-6 py-6">
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
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Emergency toggle */}
      <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-orange-900">🚨 Emergency Available</p>
          <p className="text-sm text-orange-700 mt-0.5">Accept emergency jobs outside normal hours. 15% commission applies.</p>
        </div>
        <button
          onClick={() => setEmergency(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emergency ? 'bg-red-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emergency ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
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
                <div className="flex items-center gap-4 mt-3">
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
              ) : (
                <p className="text-sm text-gray-400 mt-1">Unavailable</p>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : saved ? '✓ Changes Saved' : 'Save Availability'}
      </button>
    </div>
  )
}
