'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { MapPin, Check, Droplets, Zap, Wind, Paintbrush, Hammer, Sparkles, Leaf, Home, Bug, Shield, Wrench } from 'lucide-react'
import { CATEGORY_META } from '@/lib/service-questions'
import { invalidateOnboardingCache } from '@/components/providers/OnboardingProvider'

// Same iconography as the customer Get Quotes wizard — providers onboard into
// the trades customers can actually request, so every downstream feature
// (intake questions, search, service catalog) works from day one.
const TRADE_ICONS: Record<string, React.ElementType> = {
  plumber:      Droplets,
  electrician:  Zap,
  hvac:         Wind,
  painter:      Paintbrush,
  carpenter:    Hammer,
  cleaner:      Sparkles,
  landscaper:   Leaf,
  roofer:       Home,
  pest_control: Bug,
  security:     Shield,
  handyman:     Wrench,
}

const SERVICE_AREAS = [
  'Central London', 'North London', 'South London',
  'East London', 'West London', 'Greater London',
]

export default function SetupTradePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [areas, setAreas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Pre-fill if the provider is returning to this step
  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('trade_category, service_areas').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.trade_category) setSelected(data.trade_category)
        if (data?.service_areas?.length) setAreas(data.service_areas)
      })
  }, [user])

  function toggleArea(area: string) {
    setAreas(a => a.includes(area) ? a.filter(x => x !== area) : [...a, area])
  }

  async function handleNext() {
    if (!selected || areas.length === 0 || !user) return
    setSaving(true)
    await supabase.from('provider_profiles')
      .update({ trade_category: selected, service_areas: areas, onboarding_step: 'services' })
      .eq('user_id', user.id)
    invalidateOnboardingCache()
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
        <h1 className="text-3xl font-bold text-gray-900">What&apos;s your trade?</h1>
        <p className="mt-1 text-gray-500">Select the primary service you provide</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = TRADE_ICONS[key] ?? Wrench
          const isSelected = selected === key
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all ${
                isSelected
                  ? 'border-primary bg-primary/[0.04] shadow-[0_4px_16px_rgba(17,94,86,0.10)]'
                  : 'border-border bg-white hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(17,94,86,0.08)]'
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                isSelected ? 'bg-primary/[0.08]' : 'bg-surface group-hover:bg-primary/[0.08]'
              }`}>
                <Icon size={20} className={isSelected ? 'text-primary' : 'text-muted transition-colors group-hover:text-primary'} />
              </div>
              <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-gray-700'}`}>
                {meta.label}
              </span>
              {isSelected && (
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        Don&apos;t see your trade? These are the categories customers can request today — more are on the way.
      </p>

      {/* Service areas — required so customers always know where you work */}
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MapPin size={17} className="text-primary" /> Where do you work?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Pick the areas you cover — customers only see providers who serve their area.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREAS.map(area => {
            const active = areas.includes(area)
            return (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-primary bg-primary/[0.06] text-primary'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40'
                }`}
              >
                {active && <Check size={13} strokeWidth={3} />}
                {area}
              </button>
            )
          })}
        </div>
        {areas.length === 0 && selected && (
          <p className="text-xs text-amber-600">Select at least one area to continue.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!selected || areas.length === 0 || saving}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Next: Select Services →'}
        </button>
      </div>
    </div>
  )
}
