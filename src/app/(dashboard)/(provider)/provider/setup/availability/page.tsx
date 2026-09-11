'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { invalidateOnboardingCache } from '@/components/providers/OnboardingProvider'
import { SetupProgress } from '@/components/provider/SetupProgress'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const TIME_SLOTS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`)
  if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`)
}

interface DaySchedule { enabled: boolean; start: string; end: string }

// Onboarding default: Mon–Fri 9–5 pre-enabled so a new provider is bookable
// the moment they finish setup (they can refine on the Availability page).
const DEFAULT: Record<string, DaySchedule> = Object.fromEntries(
  KEYS.map(d => [d, {
    enabled: !['saturday', 'sunday'].includes(d),
    start: '09:00',
    end: '17:00',
  }])
)

export default function SetupAvailabilityPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [schedule, setSchedule] = useState(DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If they've somehow already saved availability (e.g. went back a step),
  // load it instead of overwriting with defaults
  useEffect(() => {
    if (!user) return
    supabase.from('provider_availability').select('*').eq('provider_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        // TIME columns return "09:00:00" — trim to "HH:MM" for the selects
        const hhmm = (v: unknown, fallback: string) =>
          typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : fallback
        const loaded: Record<string, DaySchedule> = {}
        for (const key of KEYS) {
          loaded[key] = {
            enabled: data[`${key}_enabled`] ?? false,
            start: hhmm(data[`${key}_start`], '09:00'),
            end: hhmm(data[`${key}_end`], '17:00'),
          }
        }
        setSchedule(loaded)
      })
  }, [user?.id])

  const enabledCount = KEYS.filter(k => schedule[k].enabled).length

  async function handleNext() {
    if (!user || enabledCount === 0) return
    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      provider_id: user.id,
      updated_at: new Date().toISOString(),
    }
    for (const key of KEYS) {
      payload[`${key}_enabled`] = schedule[key].enabled
      payload[`${key}_start`] = schedule[key].start
      payload[`${key}_end`] = schedule[key].end
    }

    const { error: saveError } = await supabase
      .from('provider_availability')
      .upsert(payload, { onConflict: 'provider_id' })
    if (saveError) {
      setError('Could not save your availability — please try again.')
      setSaving(false)
      return
    }

    const { data: profile } = await supabase
      .from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (profile) {
      await supabase.from('provider_profiles').update({ onboarding_step: 'documents' }).eq('id', profile.id)
    }
    invalidateOnboardingCache()
    router.push('/provider/setup/documents')
    setSaving(false)
  }

  return (
    <div className="space-y-6 pb-10">
      <SetupProgress current={2} />

      <div>
        <h1 className="text-3xl font-bold text-gray-900">When do you work?</h1>
        <p className="mt-1 text-gray-500">
          Customers can only book you during these hours. You can fine-tune breaks,
          buffer time and days off later on your Availability page.
        </p>
      </div>

      <div className="space-y-2">
        {KEYS.map((key, i) => {
          const day = schedule[key]
          return (
            <div key={key} className={`flex flex-wrap items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 transition ${day.enabled ? 'border-primary/40' : 'border-gray-100'}`}>
              <button
                type="button"
                onClick={() => setSchedule(p => ({ ...p, [key]: { ...p[key], enabled: !p[key].enabled } }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${day.enabled ? 'bg-primary' : 'bg-gray-200'}`}
                aria-label={`Toggle ${DAYS[i]}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${day.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`w-24 text-sm font-medium ${day.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{DAYS[i]}</span>
              {day.enabled ? (
                <div className="ml-auto flex items-center gap-2">
                  <select
                    value={day.start}
                    onChange={e => setSchedule(p => ({ ...p, [key]: { ...p[key], start: e.target.value } }))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-gray-400">to</span>
                  <select
                    value={day.end}
                    onChange={e => setSchedule(p => ({ ...p, [key]: { ...p[key], end: e.target.value } }))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ) : (
                <span className="ml-auto text-xs text-gray-300">Day off</span>
              )}
            </div>
          )
        })}
      </div>

      {enabledCount === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Enable at least one working day — customers can&apos;t book you with no hours set.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-sm text-gray-500">
          {enabledCount} working day{enabledCount !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleNext}
          disabled={enabledCount === 0 || saving}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Next: Upload Documents →'}
        </button>
      </div>
    </div>
  )
}
