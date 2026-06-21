'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function NewProviderServicePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [services, setServices] = useState<any[]>([])
  const [form, setForm] = useState({ service_id: '', base_price: '', price_type: 'hourly', duration_minutes: '' })
  const [isCustom, setIsCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('id, trade_category').eq('user_id', user.id).maybeSingle()
      .then(async ({ data: profile }) => {
        if (!profile) return
        const { data: cat } = await supabase.from('service_categories').select('id, name').eq('slug', profile.trade_category ?? '').maybeSingle()
        const query = supabase.from('services').select('id, title, service_categories(name)').eq('is_active', true).order('title')
        if (cat) query.eq('category_id', cat.id)
        const { data } = await query
        setServices((data ?? []).map((s: any) => ({ ...s, category: s.service_categories?.name ?? '' })))
      })
  }, [user?.id])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (isCustom && !customName.trim()) { setError('Please enter a service name'); return }
    if (!isCustom && !form.service_id) { setError('Please select a service'); return }
    setSaving(true)
    setError(null)

    const { data: profile } = await supabase.from('provider_profiles').select('id, trade_category').eq('user_id', user.id).single()
    if (!profile) { setError('Profile not found'); setSaving(false); return }

    let serviceId = form.service_id

    if (isCustom) {
      const { data: cat } = await supabase.from('service_categories').select('id').eq('slug', profile.trade_category ?? '').maybeSingle()
      const { data: newService, error: svcErr } = await supabase.from('services').insert({
        provider_id: profile.id,
        category_id: cat?.id ?? null,
        title: customName.trim(),
        description: customDesc.trim() || null,
        price_type: form.price_type,
        base_price: form.base_price ? parseFloat(form.base_price) : null,
        is_active: true,
      }).select('id').single()
      if (svcErr) { setError(svcErr.message); setSaving(false); return }
      serviceId = newService.id
    }

    const { error } = await supabase.from('provider_services').insert({
      provider_id: profile.id,
      service_id: serviceId,
      custom_price: form.base_price ? parseFloat(form.base_price) : null,
      price_type: form.price_type,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
    })
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/provider/services')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add Service</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Service</label>
            <button type="button" onClick={() => { setIsCustom(!isCustom); setForm(f => ({ ...f, service_id: '' })); setCustomName(''); setCustomDesc('') }}
              className="text-xs text-primary hover:underline">
              {isCustom ? '← Pick from list' : "Can't find yours? Add custom"}
            </button>
          </div>
          {isCustom ? (
            <div className="space-y-2">
              <input
                type="text" placeholder="Service name (e.g. Custom Pergola Build)" value={customName}
                onChange={e => setCustomName(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                placeholder="Brief description (optional)" value={customDesc}
                onChange={e => setCustomDesc(e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          ) : (
            <select value={form.service_id} onChange={e => set('service_id', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select a service…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.category ? `${s.category} — ` : ''}{s.title}</option>)}
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
            <select value={form.price_type} onChange={e => set('price_type', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {['hourly', 'fixed', 'quote'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (£)</label>
            <input type="number" step="0.01" value={form.base_price} onChange={e => set('base_price', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
          <input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Service'}
        </button>
      </form>
    </div>
  )
}
