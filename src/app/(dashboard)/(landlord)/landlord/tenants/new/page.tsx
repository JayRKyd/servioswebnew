'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { UKDateInput } from '@/components/shared/UKDateInput'

export default function NewTenantPage() {
  return <Suspense fallback={null}><NewTenantForm /></Suspense>
}
function NewTenantForm() {
  const { landlordId } = useProfileIds()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [properties, setProperties] = useState<any[]>([])
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', property_id: searchParams.get('property') ?? '', unit_number: '', lease_start: '', lease_end: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!landlordId) return
    supabase.from('properties').select('id, name').eq('landlord_id', landlordId).then(({ data }) => setProperties(data ?? []))
  }, [landlordId])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!landlordId) return
    setSaving(true)
    const { error } = await supabase.from('tenants').insert({ ...form, landlord_id: landlordId, lease_start: form.lease_start || null, lease_end: form.lease_end || null })
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/landlord/tenants')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add Tenant</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input required value={form.first_name} onChange={e => set('first_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input required value={form.last_name} onChange={e => set('last_name', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
          <select required value={form.property_id} onChange={e => set('property_id', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select property…</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label><input value={form.unit_number} onChange={e => set('unit_number', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Lease Start</label><UKDateInput value={form.lease_start} onChange={v => set('lease_start', v)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Lease End</label><UKDateInput value={form.lease_end} onChange={v => set('lease_end', v)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Add Tenant'}</button>
      </form>
    </div>
  )
}
