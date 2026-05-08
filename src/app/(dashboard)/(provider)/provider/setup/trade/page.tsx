'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'

const TRADE_ICONS: Record<string, string> = {
  plumber: '🔧', electrician: '⚡', ac_hvac: '❄️', carpenter: '🪚',
  painter: '🎨', cleaner: '🧹', landscaper: '🌿', mason: '🧱',
  roofer: '🏠', handyman: '🛠️',
}

export default function SetupTradePage() {
  const router = useRouter()
  const [trades, setTrades] = useState<{ value: string; label: string }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('service_categories').select('slug, name').eq('is_active', true).order('name')
      .then(({ data }) => setTrades((data ?? []).map((c: any) => ({ value: c.slug, label: c.name }))))
  }, [])

  async function handleNext() {
    if (!selected) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('provider_profiles').update({ trade_category: selected, onboarding_step: 'services' }).eq('user_id', user!.id)
    router.push('/provider/setup/services')
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Trade', 'Services', 'Documents'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1}
            </div>
            <span className={`text-sm ${i === 0 ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className="mx-1 h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">What's your trade?</h1>
        <p className="mt-1 text-gray-500">Select the primary service you provide</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {trades.map((trade) => (
          <button
            key={trade.value}
            onClick={() => setSelected(trade.value)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition hover:border-blue-400 hover:bg-primary/[0.06] ${
              selected === trade.value ? 'border-primary bg-primary/[0.06]' : 'border-gray-100 bg-white'
            }`}
          >
            <span className="text-3xl">{TRADE_ICONS[trade.value] ?? '🔨'}</span>
            <span className={`text-sm font-semibold ${selected === trade.value ? 'text-primary' : 'text-gray-700'}`}>
              {trade.label}
            </span>
            {selected === trade.value && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white font-bold">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!selected || saving}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Next: Select Services →'}
        </button>
      </div>
    </div>
  )
}
