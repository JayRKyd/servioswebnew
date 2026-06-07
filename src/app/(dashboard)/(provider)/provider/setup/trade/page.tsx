'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { getTradeIcon } from '@/lib/trade-icons'

const GROUP_LABELS: Record<string, string> = {
  trades_repairs: 'Trades & Repairs',
  property_professionals: 'Property Professionals',
  cleaning: 'Cleaning Services',
  automotive: 'Automotive & Mobile Vehicle Services',
  specialist: 'Specialist Restoration & Craft',
}

const GROUP_ORDER = ['trades_repairs', 'property_professionals', 'cleaning', 'automotive', 'specialist']

interface Trade { slug: string; name: string; group_slug: string }

export default function SetupTradePage() {
  const router = useRouter()
  const [tradesByGroup, setTradesByGroup] = useState<Record<string, Trade[]>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('service_categories')
      .select('slug, name, group_slug')
      .eq('is_active', true)
      .not('group_slug', 'is', null)
      .order('display_order')
      .then(({ data }) => {
        const seen = new Set<string>()
        const grouped: Record<string, Trade[]> = {}
        ;(data ?? []).forEach((c: any) => {
          if (seen.has(c.slug)) return
          seen.add(c.slug)
          if (!grouped[c.group_slug]) grouped[c.group_slug] = []
          grouped[c.group_slug].push(c)
        })
        setTradesByGroup(grouped)
      })
  }, [])

  // Pre-fill if returning to this step
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('provider_profiles')
        .select('trade_categories, trade_category')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.trade_categories?.length > 0) {
        setSelected(data.trade_categories)
      } else if (data?.trade_category) {
        setSelected([data.trade_category])
      }
    })
  }, [])

  function toggle(slug: string) {
    setSelected(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    )
  }

  async function handleNext() {
    if (selected.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('provider_profiles').update({
      trade_categories: selected,
      trade_category: selected[0] ?? null,
      onboarding_step: 'services',
    }).eq('user_id', user!.id)
    router.push('/provider/setup/services')
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10">
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
        <h1 className="text-3xl font-bold text-gray-900">What services do you offer?</h1>
        <p className="mt-1 text-gray-500">Select all trades that apply — you can offer multiple.</p>
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 mr-1">Selected:</span>
          {selected.map(slug => {
            const label = Object.values(tradesByGroup).flat().find(t => t.slug === slug)?.name ?? slug
            return (
              <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                {label}
                <button type="button" onClick={() => toggle(slug)} className="ml-0.5 opacity-70 hover:opacity-100">✕</button>
              </span>
            )
          })}
        </div>
      )}

      <div className="space-y-8">
        {GROUP_ORDER.filter(g => tradesByGroup[g]?.length).map(group => (
          <div key={group}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
              {GROUP_LABELS[group]}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {tradesByGroup[group].map(trade => {
                const isSelected = selected.includes(trade.slug)
                const Icon = getTradeIcon(trade.slug)
                return (
                  <button
                    key={trade.slug}
                    type="button"
                    onClick={() => toggle(trade.slug)}
                    className={
                      'relative flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm transition ' +
                      (isSelected
                        ? 'border-primary bg-primary/[0.06] font-semibold text-primary'
                        : 'border-gray-100 bg-white font-medium text-gray-700 hover:border-blue-200 hover:bg-blue-50/40')
                    }
                  >
                    {isSelected ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] text-white font-bold">✓</span>
                    ) : (
                      <Icon size={14} className="shrink-0 text-gray-400" />
                    )}
                    <span>{trade.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <p className="text-sm text-gray-400">
          {selected.length === 0 ? 'Select at least one trade to continue' : `${selected.length} trade${selected.length !== 1 ? 's' : ''} selected`}
        </p>
        <button
          onClick={handleNext}
          disabled={selected.length === 0 || saving}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Next: Select Services →'}
        </button>
      </div>
    </div>
  )
}
