'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'

interface Template {
  id: string; name: string; description: string | null
  price_min: number | null; price_type: 'fixed' | 'hourly' | 'quote'
}
interface TradeTab {
  slug: string; name: string; categoryId: string; templates: Template[]
}
interface Selected {
  templateId: string | null; name: string; description: string
  price: string; priceType: 'fixed' | 'hourly' | 'quote'
  isCustom: boolean; categoryId: string | null
}

export default function SetupServicesPage() {
  const router = useRouter()
  const [tabs, setTabs] = useState<TradeTab[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [selected, setSelected] = useState<Record<string, Selected>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customType, setCustomType] = useState<'fixed' | 'hourly' | 'quote'>('fixed')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('provider_profiles')
        .select('trade_categories, trade_category')
        .eq('user_id', user.id)
        .maybeSingle()

      const slugs: string[] = profile?.trade_categories?.length
        ? profile.trade_categories
        : profile?.trade_category ? [profile.trade_category] : []

      if (slugs.length === 0) { router.replace('/provider/setup/trade'); return }

      // Load category rows for all slugs
      const { data: cats } = await supabase
        .from('service_categories')
        .select('id, slug, name')
        .in('slug', slugs)

      if (!cats || cats.length === 0) { setLoading(false); return }

      // Load services for all category IDs in one query
      const catIds = cats.map((c: any) => c.id)
      const { data: svcs } = await supabase
        .from('services')
        .select('id, title, description, base_price, price_type, category_id')
        .in('category_id', catIds)
        .eq('is_active', true)
        .order('title')

      const svcsByCategory: Record<string, Template[]> = {}
      ;(svcs ?? []).forEach((s: any) => {
        if (!svcsByCategory[s.category_id]) svcsByCategory[s.category_id] = []
        svcsByCategory[s.category_id].push({
          id: s.id, name: s.title, description: s.description,
          price_min: s.base_price, price_type: s.price_type ?? 'fixed',
        })
      })

      // Build tabs in the same order as slugs (preserves user selection order)
      const orderedTabs: TradeTab[] = slugs
        .map(slug => cats.find((c: any) => c.slug === slug))
        .filter(Boolean)
        .map((c: any) => ({
          slug: c.slug, name: c.name, categoryId: c.id,
          templates: svcsByCategory[c.id] ?? [],
        }))

      setTabs(orderedTabs)
      setLoading(false)
    })
  }, [router])

  function toggle(t: Template, categoryId: string) {
    setSelected(prev => {
      const n = { ...prev }
      if (n[t.id]) { delete n[t.id] }
      else {
        n[t.id] = {
          templateId: t.id, name: t.name, description: t.description ?? '',
          price: t.price_min != null ? String(t.price_min) : '',
          priceType: t.price_type, isCustom: false, categoryId,
        }
      }
      return n
    })
  }

  function addCustom() {
    if (!customName.trim() || (!customPrice.trim() && customType !== 'quote')) return
    const id = `custom_${Date.now()}`
    const categoryId = tabs[activeTab]?.categoryId ?? null
    setSelected(prev => ({
      ...prev,
      [id]: { templateId: null, name: customName.trim(), description: '', price: customPrice.trim(), priceType: customType, isCustom: true, categoryId },
    }))
    setCustomName(''); setCustomPrice(''); setShowCustom(false)
  }

  async function handleNext() {
    const services = Object.values(selected)
    if (services.length === 0) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('provider_profiles').select('id').eq('user_id', user!.id).maybeSingle()
    if (!profile) { setSaving(false); return }

    const entries = Object.entries(selected)
    const customResolvedIds: Record<string, string> = {}

    // Insert custom services first
    for (const [key, svc] of entries) {
      if (!svc.isCustom) continue
      const { data: inserted } = await supabase
        .from('services')
        .insert({
          title: svc.name, description: svc.description || svc.name,
          category_id: svc.categoryId ?? null,
          price_type: svc.priceType,
          base_price: svc.priceType !== 'quote' ? Number(svc.price) || null : null,
          currency: 'gbp', is_active: true,
        })
        .select('id').single()
      if (inserted?.id) customResolvedIds[key] = inserted.id
    }

    const rows = entries
      .map(([key, svc]) => {
        const serviceId = svc.isCustom ? customResolvedIds[key] : svc.templateId
        if (!serviceId) return null
        return {
          provider_id: profile.id, service_id: serviceId,
          custom_price: svc.priceType === 'quote' ? null : Number(svc.price) || null,
          is_active: true,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length > 0) {
      await supabase.from('provider_services').upsert(rows, { onConflict: 'provider_id,service_id' })
    }
    await supabase.from('provider_profiles').update({ onboarding_step: 'documents' }).eq('id', profile.id)
    router.push('/provider/setup/documents')
    setSaving(false)
  }

  const count = Object.keys(selected).length
  const currentTab = tabs[activeTab]

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Trade', 'Services', 'Documents'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < 1 ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === 1 ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className="mx-1 h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Your services</h1>
        <p className="mt-1 text-gray-500">Tick what you offer and set your prices in £ GBP</p>
      </div>

      {/* Trade tabs (only shown when provider selected multiple trades) */}
      {tabs.length > 1 && (
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.slug}
              onClick={() => { setActiveTab(i); setShowCustom(false) }}
              className={
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition truncate px-2 ' +
                (activeTab === i ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')
              }
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {currentTab && (
        <>
          <div className="space-y-3">
            {currentTab.templates.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No service templates for this trade yet. Add your own below.</p>
            ) : (
              currentTab.templates.map(t => {
                const isSel = Boolean(selected[t.id])
                const svc = selected[t.id]
                return (
                  <div key={t.id} className={`rounded-xl border-2 bg-white transition ${isSel ? 'border-primary' : 'border-gray-100'}`}>
                    <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => toggle(t, currentTab.categoryId)}>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${isSel ? 'border-primary bg-primary' : 'border-gray-300'}`}>
                        {isSel && <span className="text-[11px] font-bold text-white">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{t.name}</p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${isSel ? 'bg-primary/[0.06] text-primary' : 'bg-gray-50 text-gray-400'}`}>
                        {t.price_type === 'hourly' ? '/hr' : t.price_type === 'quote' ? 'Quote' : 'Fixed'}
                      </span>
                    </button>
                    {isSel && t.price_type !== 'quote' && (
                      <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
                        <label className="text-sm text-gray-600 font-medium">Your price (£)</label>
                        <input
                          type="number"
                          value={svc?.price ?? ''}
                          onChange={e => setSelected(prev => ({ ...prev, [t.id]: { ...prev[t.id], price: e.target.value } }))}
                          className="ml-auto w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Custom services for this tab */}
            {Object.values(selected).filter(s => s.isCustom && s.categoryId === currentTab.categoryId).map(svc => (
              <div key={svc.name} className="rounded-xl border-2 border-dashed border-blue-300 bg-primary/[0.06] p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{svc.name}</p>
                  <p className="text-xs text-gray-500">£{svc.price} · {svc.priceType}</p>
                </div>
                <button
                  onClick={() => {
                    const id = Object.keys(selected).find(k => selected[k] === svc)
                    if (id) setSelected(prev => { const n = { ...prev }; delete n[id]; return n })
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}

            {showCustom ? (
              <div className="rounded-xl border-2 border-blue-400 bg-white p-4 space-y-3">
                <p className="font-semibold text-gray-900">Add custom service</p>
                <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Service name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex gap-2">
                  <input value={customPrice} onChange={e => setCustomPrice(e.target.value)} placeholder="Price (£)"
                    type="number" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    {(['fixed', 'hourly', 'quote'] as const).map(pt => (
                      <button key={pt} onClick={() => setCustomType(pt)}
                        className={`px-3 py-2 font-medium capitalize ${customType === pt ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                        {pt === 'hourly' ? '/hr' : pt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCustom(false)} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button onClick={addCustom} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-dark">Add Service</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCustom(true)}
                className="w-full rounded-xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-primary hover:border-blue-300 hover:bg-primary/[0.06]">
                + Add a {currentTab.name} service not listed above
              </button>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-sm text-gray-500">{count} service{count !== 1 ? 's' : ''} selected across all trades</span>
        <button
          onClick={handleNext}
          disabled={count === 0 || saving}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Next: Upload Documents →'}
        </button>
      </div>
    </div>
  )
}
