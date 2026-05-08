'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

const PRIORITIES = ['low', 'medium', 'high', 'emergency']

export default function ReportIssuePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [tenancy, setTenancy] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('tenants').select('property_id, landlord_id').eq('user_id', user.id).eq('is_active', true).single()
      .then(({ data }) => setTenancy(data))
  }, [user?.id])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !tenancy) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('maintenance_requests').insert({
      tenant_id: user.id,
      property_id: tenancy.property_id,
      landlord_id: tenancy.landlord_id,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: 'pending',
    })
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/tenant/maintenance')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Report an Issue</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Leaking faucet in kitchen" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea required rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the issue in detail…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map(p => (
              <button key={p} type="button" onClick={() => set('priority', p)}
                className={'flex-1 rounded-lg px-3 py-2 text-xs font-medium capitalize transition ' + (form.priority === p ? (p === 'emergency' ? 'bg-red-600 text-white' : 'bg-primary text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {!tenancy && <p className="text-sm text-yellow-600">No active tenancy found. You must be a registered tenant to submit requests.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={saving || !tenancy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
