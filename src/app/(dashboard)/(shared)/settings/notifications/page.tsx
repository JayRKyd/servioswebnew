'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'

const EVENT_TYPES = [
  { key: 'booking_requests', label: 'Booking requests', description: 'New booking requests and status changes' },
  { key: 'messages', label: 'Messages', description: 'New messages in your conversations' },
  { key: 'payouts', label: 'Payouts & payments', description: 'Payment releases, milestones, and earnings' },
  { key: 'reminders', label: 'Reminders', description: 'Upcoming jobs, deadlines, and follow-ups' },
]

const CHANNELS = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
]

const DEFAULTS = {
  booking_requests: { push: true, email: true, sms: false },
  messages: { push: true, email: false, sms: false },
  payouts: { push: true, email: true, sms: false },
  reminders: { push: true, email: true, sms: false },
}

type Prefs = Record<string, Record<string, boolean>>

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', user.id)
        .maybeSingle()

      if (data?.notification_preferences && Object.keys(data.notification_preferences).length > 0) {
        const saved = data.notification_preferences as Prefs
        const merged: Prefs = {}
        for (const key of Object.keys(DEFAULTS)) {
          merged[key] = { ...DEFAULTS[key], ...(saved[key] ?? {}) }
        }
        setPrefs(merged)
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggle(eventKey: string, channelKey: string) {
    setPrefs(p => ({
      ...p,
      [eventKey]: { ...p[eventKey], [channelKey]: !p[eventKey]?.[channelKey] },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('users')
        .update({ notification_preferences: prefs })
        .eq('id', user.id)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500 mt-1">Choose how and when you want to be notified.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_repeat(3,_56px)] gap-2 border-b border-gray-100 px-5 py-3">
          <span />
          {CHANNELS.map(c => (
            <span key={c.key} className="text-center text-xs font-semibold uppercase text-gray-400">{c.label}</span>
          ))}
        </div>

        {/* Event rows */}
        {EVENT_TYPES.map((event, i) => (
          <div
            key={event.key}
            className={`grid grid-cols-[1fr_repeat(3,_56px)] gap-2 items-center px-5 py-4 ${i > 0 ? 'border-t border-gray-50' : ''}`}
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{event.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
            </div>
            {CHANNELS.map(channel => (
              <div key={channel.key} className="flex justify-center">
                <Toggle
                  checked={prefs[event.key]?.[channel.key] ?? false}
                  onChange={() => toggle(event.key, channel.key)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        SMS notifications require a verified phone number. Push notifications require the Servios app.
      </p>
    </div>
  )
}
