'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const EMERGENCY_SERVICES = [
  { label: 'Police / Fire / Ambulance', number: '999', icon: '🚨' },
  { label: 'Gas Emergency (National Grid)', number: '0800 111 999', icon: '🔥' },
  { label: 'Non-emergency Police', number: '101', icon: '👮' },
  { label: 'NHS (non-emergency)', number: '111', icon: '🏥' },
]

interface Property { id: string; name: string; address_line1: string }
interface Provider { id: string; user_id: string; business_name: string | null; first_name: string | null; last_name: string | null; trade_category: string | null; phone: string | null }

export default function EmergencyDispatchPage() {
  const router = useRouter()

  const [properties, setProperties] = useState<Property[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProperty, setSelectedProperty] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [issue, setIssue] = useState('')
  const [notes, setNotes] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [dispatched, setDispatched] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: props }, { data: preferred }] = await Promise.all([
        supabase.from('properties').select('id, name, address_line1').eq('landlord_id', user.id),
        supabase.from('preferred_providers').select(`
          provider:provider_profiles(id, user_id, business_name, trade_category,
            users:user_id(first_name, last_name, phone))
        `).eq('landlord_id', user.id),
      ])

      setProperties(props ?? [])

      const mapped: Provider[] = (preferred ?? [])
        .map((p: any) => ({
          id: p.provider?.id,
          user_id: p.provider?.user_id,
          business_name: p.provider?.business_name,
          first_name: p.provider?.users?.first_name,
          last_name: p.provider?.users?.last_name,
          trade_category: p.provider?.trade_category,
          phone: p.provider?.users?.phone,
        }))
        .filter((p: Provider) => p.id)

      setProviders(mapped)
      if (props?.[0]) setSelectedProperty(props[0].id)
    }
    load()
  }, [])

  async function handleDispatch() {
    if (!selectedProperty || !issue.trim()) return
    setDispatching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/v1/maintenance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: selectedProperty,
          title: issue.trim(),
          description: notes.trim() || issue.trim(),
          priority: 'emergency',
        }),
      })
      if (!res.ok) throw new Error('Dispatch failed')
      setDispatched(true)
    } catch {
      alert('Failed to dispatch. Please try again.')
    } finally {
      setDispatching(false)
    }
  }

  if (dispatched) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-6">
        <div className="text-6xl">📢</div>
        <h1 className="text-2xl font-bold text-gray-900">Emergency Dispatched</h1>
        <p className="text-gray-500">
          {selectedProvider
            ? `${providers.find(p => p.id === selectedProvider)?.business_name ?? 'The provider'} has been notified.`
            : 'An emergency request has been logged and providers will be notified.'}
        </p>
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-left space-y-2">
          <p className="text-sm font-semibold text-red-700">Emergency Services</p>
          {EMERGENCY_SERVICES.map(s => (
            <div key={s.number} className="flex justify-between text-sm">
              <span className="text-gray-600">{s.icon} {s.label}</span>
              <a href={`tel:${s.number.replace(/\s/g, '')}`} className="font-bold text-red-600 hover:underline">{s.number}</a>
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/landlord')} className="rounded-xl bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-gray-800">
          Return to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">🚨 Emergency Dispatch</h1>
        <p className="text-sm text-gray-500 mt-1">Dispatch an emergency provider immediately. 15% commission applies to emergency jobs.</p>
      </div>

      {/* 999 callout */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Life-threatening emergencies</p>
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_SERVICES.map(s => (
            <a
              key={s.number}
              href={`tel:${s.number.replace(/\s/g, '')}`}
              className="flex items-center justify-between rounded-lg bg-white border border-amber-100 px-3 py-2 hover:bg-amber-50 transition-colors"
            >
              <span className="text-sm text-gray-700">{s.icon} {s.label}</span>
              <span className="text-sm font-bold text-red-600 ml-2">{s.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Dispatch form */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Dispatch a Provider</h2>

        {/* Property */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Property <span className="text-red-500">*</span></label>
          <select
            value={selectedProperty}
            onChange={e => setSelectedProperty(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Select property…</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name ?? p.address_line1}</option>
            ))}
          </select>
        </div>

        {/* Issue */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Issue <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={issue}
            onChange={e => setIssue(e.target.value)}
            placeholder="e.g. Burst pipe, boiler failure, no heating"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Provider */}
        {providers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Provider <span className="text-gray-400 font-normal">(optional)</span></label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="provider" value="" checked={selectedProvider === ''} onChange={() => setSelectedProvider('')} />
                <span className="text-sm text-gray-600">Auto-assign fastest available</span>
              </label>
              {providers.map(p => (
                <label key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <input type="radio" name="provider" value={p.id} checked={selectedProvider === p.id} onChange={() => setSelectedProvider(p.id)} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.business_name ?? `${p.first_name} ${p.last_name}`}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.trade_category}</p>
                    </div>
                  </div>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="text-xs font-medium text-primary hover:underline" onClick={e => e.stopPropagation()}>
                      📞 Call
                    </a>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Access instructions, key location, any safety concerns…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        <button
          onClick={handleDispatch}
          disabled={!selectedProperty || !issue.trim() || dispatching}
          className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {dispatching ? 'Dispatching…' : '🚨 Dispatch Emergency Provider'}
        </button>
      </div>
    </div>
  )
}
