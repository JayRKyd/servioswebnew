'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { BAHAMAS_ISLANDS } from '@/lib/constants'

export default function EditProviderProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ first_name: '', last_name: '', business_name: '', bio: '', hourly_rate: '', service_areas: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)
  const [baseLocation, setBaseLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('first_name, last_name, business_name, bio, hourly_rate, service_areas, base_location').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({ first_name: data.first_name ?? '', last_name: data.last_name ?? '', business_name: data.business_name ?? '', bio: data.bio ?? '', hourly_rate: data.hourly_rate?.toString() ?? '', service_areas: data.service_areas ?? [] })
        if (data.base_location?.lat) { setBaseLocation(data.base_location); setLocationSet(true) }
      }
    })
  }, [user?.id])

  function set(key: string, value: any) { setForm(f => ({ ...f, [key]: value })) }

  function toggleArea(area: string) {
    setForm(f => ({ ...f, service_areas: f.service_areas.includes(area) ? f.service_areas.filter(i => i !== area) : [...f.service_areas, area] }))
  }

  function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBaseLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationSet(true)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10_000 }
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    const payload: Record<string, any> = {
      first_name: form.first_name,
      last_name: form.last_name,
      business_name: form.business_name,
      bio: form.bio,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      service_areas: form.service_areas,
    }
    if (baseLocation) payload.base_location = baseLocation
    const { error } = await supabase.from('provider_profiles').update(payload).eq('user_id', user.id)
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/provider/profile')
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-2 gap-4">
          {(['first_name', 'last_name'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{k === 'first_name' ? 'First Name' : 'Last Name'}</label>
              <input required value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input required value={form.business_name} onChange={e => set('business_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£/hr)</label>
          <input type="number" step="0.01" value={form.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Areas</label>
          <div className="flex flex-wrap gap-2">
            {BAHAMAS_ISLANDS.map(area => (
              <button key={area} type="button" onClick={() => toggleArea(area)}
                className={'rounded-full px-3 py-1 text-xs font-medium transition ' + (form.service_areas.includes(area) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
                {area}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Location</label>
          {locationSet
            ? <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">
                <span>📍</span><span>Location saved</span>
                <button type="button" onClick={() => { setLocationSet(false); setBaseLocation(null) }} className="ml-auto text-xs text-gray-400 hover:text-red-500">Remove</button>
              </div>
            : <button type="button" onClick={detectLocation} disabled={locating}
                className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary transition disabled:opacity-50">
                {locating ? 'Detecting…' : '📍 Use my current location'}
              </button>
          }
          <p className="mt-1 text-xs text-gray-400">Used to show your distance to customers on search</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  )
}
