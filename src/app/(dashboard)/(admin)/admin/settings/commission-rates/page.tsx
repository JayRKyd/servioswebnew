'use client'
import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

const DEFAULT_RATES = { standard: 12, preferred: 10, emergency: 15 }

export default function CommissionRatesPage() {
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    apiClient<{ rates: typeof DEFAULT_RATES }>('/api/v1/settings/commission').then(({ data }) => {
      if (data?.rates) setRates(data.rates)
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setStatus('idle')
    const { error } = await apiClient('/api/v1/settings/commission', {
      method: 'PATCH',
      body: JSON.stringify(rates),
    })
    setSaving(false)
    if (error) { setErrorMsg(error); setStatus('error') }
    else {
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const LABELS: Record<keyof typeof DEFAULT_RATES, string> = {
    standard:  'Standard (direct customer booking)',
    preferred: 'Preferred (invited provider, landlord job)',
    emergency: 'Emergency booking',
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark tracking-[-0.02em]">Commission Rates</h1>
        <p className="mt-1 text-[13.5px] text-muted">Rates deducted from provider payouts at job completion.</p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 text-sm text-muted">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <div className="rounded-lg bg-primary/[0.05] border border-primary/20 px-4 py-3 text-[13px] text-primary space-y-1">
            <p className="font-semibold">How commission works</p>
            <p>Emergency rate takes priority. For landlord bookings with an invited provider relationship, the preferred rate applies. All other bookings use the standard rate.</p>
          </div>

          {(Object.keys(DEFAULT_RATES) as (keyof typeof DEFAULT_RATES)[]).map(type => (
            <div key={type} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13.5px] font-medium text-dark capitalize">{type}</p>
                <p className="text-[12px] text-muted">{LABELS[type]}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={rates[type]}
                  onChange={e => setRates(r => ({ ...r, [type]: parseFloat(e.target.value) || 0 }))}
                  className="w-20 rounded-lg border border-border bg-[#fafbfa] px-3 py-2 text-[14px] text-dark text-right outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <span className="text-[13px] text-muted w-4">%</span>
              </div>
            </div>
          ))}

          {status === 'saved' && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-[13px] text-green-700 font-medium">
              Rates saved successfully
            </div>
          )}
          {status === 'error' && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving…' : 'Save Rates'}
          </button>
        </form>
      )}
    </div>
  )
}
