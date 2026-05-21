'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'

const PROPERTY_TYPES = ['residential', 'commercial', 'vacation_rental', 'multi_unit']

export default function NewPropertyPage() {
  const { landlordId, loading: idsLoading } = useProfileIds()
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', property_type: 'residential',
    street: '', city: '', region: '',
    bedrooms: '', bathrooms: '', units: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!landlordId) { setError('Landlord profile not found. Please complete setup first.'); return }
    setSaving(true)
    setError(null)
    const { data, error } = await supabase.from('properties').insert({
      landlord_id: landlordId,
      name: form.name,
      property_type: form.property_type,
      address: { street: form.street, city: form.city, region: form.region },
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
      units: form.units ? parseInt(form.units) : null,
      notes: form.notes || null,
    }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/landlord/properties/' + data.id)
  }

  if (idsLoading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add Property</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. 12 Oak Street, Flat 2" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input required value={form.street} onChange={e => set('street', e.target.value)} placeholder="e.g. 12 Oak Street" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City / Town</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. London" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region / Area</label>
            <input value={form.region} onChange={e => set('region', e.target.value)} placeholder="e.g. Greater London" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {(['bedrooms', 'bathrooms', 'units'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{k}</label>
              <input type="number" min="0" value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving || !landlordId} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Saving…' : 'Add Property'}
        </button>
      </form>
    </div>
  )
}
