'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { UKDateInput } from '@/components/shared/UKDateInput'

type Property = { id: string; address: string }
type Service = { id: string; name: string; category: string }
type Provider = { id: string; business_name: string | null; full_name: string | null }

export default function NewQuoteRequestPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [providerSearch, setProviderSearch] = useState('')

  const [properties, setProperties] = useState<Property[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [providers, setProviders] = useState<Provider[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    // Load properties, services, providers in parallel
    Promise.all([
      supabase.from('properties').select('id, address').eq('landlord_id', user.id),
      supabase.from('services').select('id, name, category').order('category'),
      supabase
        .from('provider_profiles')
        .select('user_id, business_name, full_name')
        .eq('is_verified', true),
    ]).then(([{ data: props }, { data: svcs }, { data: provs }]) => {
      setProperties(props ?? [])
      setServices(svcs ?? [])
      setProviders(
        (provs ?? []).map((p: any) => ({
          id: p.user_id,
          business_name: p.business_name,
          full_name: p.full_name,
        }))
      )
    })
  }, [user?.id])

  function toggleProvider(id: string) {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (selectedProviders.length === 0) {
      setError('Select at least one provider to invite.')
      return
    }
    setSubmitting(true)
    setError(null)

    // 1. Create quote request
    const { data: qr, error: qrErr } = await supabase
      .from('quote_requests')
      .insert({
        landlord_id: user.id,
        title,
        description: description || null,
        scheduled_date: scheduledDate || null,
        property_id: propertyId || null,
        service_id: serviceId || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (qrErr || !qr) {
      setError(qrErr?.message ?? 'Failed to create quote request.')
      setSubmitting(false)
      return
    }

    // 2. Invite providers
    const rows = selectedProviders.map((pid) => ({
      quote_request_id: qr.id,
      provider_id: pid,
    }))
    const { error: inviteErr } = await supabase.from('quote_request_providers').insert(rows)

    if (inviteErr) {
      setError(inviteErr.message)
      setSubmitting(false)
      return
    }

    router.push('/landlord/quotes/' + qr.id)
  }

  const filteredProviders = providers.filter((p) => {
    const name = (p.business_name ?? p.full_name ?? '').toLowerCase()
    return name.includes(providerSearch.toLowerCase())
  })

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">New Quote Request</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Job title *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Replace hot water heater in Unit 3"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the work needed, any access requirements, etc."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Property + Service */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Select property —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Service type</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Select service —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scheduled date */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Preferred date</label>
          <UKDateInput
            value={scheduledDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={setScheduledDate}
            className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Provider selection */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Invite providers *</label>
            <p className="text-xs text-gray-400 mt-0.5">
              Select one or more verified providers to send this request to.
            </p>
          </div>

          <input
            type="text"
            placeholder="Search providers…"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {filteredProviders.length === 0 ? (
              <p className="p-4 text-sm text-gray-400">No verified providers found.</p>
            ) : (
              filteredProviders.map((p) => {
                const checked = selectedProviders.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProvider(p.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary"
                    />
                    <span className="text-sm text-gray-700">
                      {p.business_name ?? p.full_name ?? p.id}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {selectedProviders.length > 0 && (
            <p className="text-xs text-primary font-medium">
              {selectedProviders.length} provider{selectedProviders.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send Quote Request'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
