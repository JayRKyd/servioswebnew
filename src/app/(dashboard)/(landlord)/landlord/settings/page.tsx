'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function LandlordSettingsPage() {
  const { user } = useAuth()
  const [threshold, setThreshold] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('landlord_profiles')
      .select('auto_approve_threshold')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.auto_approve_threshold != null) {
          setThreshold(data.auto_approve_threshold.toString())
          setEnabled(true)
        }
        setLoading(false)
      })
  }, [user?.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)

    const newThreshold = enabled && threshold ? parseFloat(threshold) : null

    const { error } = await supabase
      .from('landlord_profiles')
      .update({ auto_approve_threshold: newThreshold })
      .eq('user_id', user.id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Landlord Settings</h1>

      {/* Auto-approval */}
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Auto-Approval Threshold</h2>
          <p className="mt-1 text-sm text-gray-500">
            Bookings and maintenance jobs at or under this amount are automatically approved —
            no action needed from you. Useful for recurring small jobs where you trust your preferred providers.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => { setEnabled(!enabled); if (enabled) setThreshold('') }}
              className={'relative inline-flex h-6 w-11 items-center rounded-full transition ' + (enabled ? 'bg-primary' : 'bg-gray-200')}
            >
              <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition ' + (enabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <span className="text-sm font-medium text-gray-700">Enable auto-approval</span>
          </label>

          {enabled && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Threshold amount (£)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">£</span>
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  placeholder="500.00"
                  className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-gray-400">
                Jobs ≤ £{threshold || '—'} will be auto-approved when submitted by a trusted provider.
              </p>
            </div>
          )}

          {enabled && (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200 space-y-1">
              <p className="font-medium">How it works</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Applies to bookings linked to your properties where the total is known at creation</li>
                <li>Only trusted/verified providers benefit from auto-approval</li>
                <li>You still receive a notification — you can cancel within 2 hours</li>
                <li>Emergency bookings always require manual approval regardless of threshold</li>
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {saved && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Settings saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </section>
    </div>
  )
}
