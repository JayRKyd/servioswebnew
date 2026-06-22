'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Droplets, Zap, Wind, Paintbrush, Hammer, Sparkles, Leaf, Home, Bug, Shield, Wrench, Star, BadgeCheck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { titleCase } from '@/lib/utils'
import {
  CATEGORY_META, SERVICE_QUESTIONS, LOCATION_STEP,
} from '@/lib/service-questions'
import type { QuestionStep, QuestionOption } from '@/lib/service-questions'

const CATEGORY_ICONS: Record<string, React.ElementType> = {
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

// ─── Provider card (browse section) ───────────────────────────────────────────

function ProviderBrowseCard({ provider }: { provider: any }) {
  const displayName = provider.business_name
    ?? `${titleCase(provider.first_name)} ${titleCase(provider.last_name)}`
  const initials = provider.business_name
    ? provider.business_name.charAt(0).toUpperCase()
    : `${provider.first_name?.[0] ?? ''}${provider.last_name?.[0] ?? ''}`.toUpperCase()
  const meta = provider.trade_category ? CATEGORY_META[provider.trade_category] : null

  return (
    <Link href={`/providers/${provider.user_id}`} className="group block">
      {/* Photo / avatar area */}
      <div className={`relative aspect-[4/3] overflow-hidden rounded-2xl mb-3 ${meta?.color ?? 'bg-gray-100'} flex items-center justify-center`}>
        {provider.profile_image_url ? (
          <img
            src={provider.profile_image_url}
            alt={displayName}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className={`text-5xl font-bold opacity-30 select-none ${meta?.accent ?? 'text-gray-400'}`}>
            {initials}
          </span>
        )}
        {provider.identity_verified && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm">
            <BadgeCheck size={11} /> Verified
          </span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-0.5 px-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          {provider.rating_average != null && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-gray-700">
              <Star size={11} className="fill-amber-400 stroke-amber-400" />
              {Number(provider.rating_average).toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 capitalize">{meta?.label ?? provider.trade_category?.replace(/_/g, ' ')}</p>
        <div className="flex items-center justify-between pt-0.5">
          {provider.service_areas?.length > 0 && (
            <span className="text-xs text-gray-400 truncate">{provider.service_areas.slice(0, 2).join(', ')}</span>
          )}
          {provider.hourly_rate != null && (
            <span className="text-xs font-semibold text-gray-900 shrink-0 ml-auto">
              <span className="font-normal text-gray-500">From </span>£{provider.hourly_rate}/hr
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Category picker ───────────────────────────────────────────────────────────

function CategoryPicker({ onPick }: { onPick: (cat: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Object.entries(CATEGORY_META).map(([key, meta]) => {
        const Icon = CATEGORY_ICONS[key] ?? Wrench
        return (
          <button
            key={key}
            onClick={() => onPick(key)}
            className={`group flex flex-col items-center gap-3 rounded-2xl border border-transparent ${meta.color} p-5 text-center transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/60 shadow-sm`}>
              <Icon size={22} className={meta.accent} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">{meta.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Tap to get matched</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Location search step ──────────────────────────────────────────────────────

function LocationSearch({
  stepIndex, totalSteps, onSelect, onBack,
}: {
  stepIndex: number; totalSteps: number; onSelect: (value: string) => void; onBack: () => void
}) {
  const [query, setQuery] = useState('')
  const allOptions = LOCATION_STEP.options
  const filtered = query.trim()
    ? allOptions.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : allOptions
  const progress = ((stepIndex + 1) / totalSteps) * 100

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-dark transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="space-y-2">
          <div className="flex justify-between text-[11.5px]">
            <span className="font-semibold text-primary uppercase tracking-wide">Location</span>
            <span className="text-muted">Step {stepIndex + 1} of {totalSteps}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-[#f0f0f0]">
            <div className="h-1 rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[1.5rem] font-bold text-dark tracking-[-0.02em]">{LOCATION_STEP.question}</h2>
        <p className="mt-1 text-[13.5px] text-muted">{LOCATION_STEP.hint}</p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search city…"
          className="w-full rounded-xl border border-border bg-[#fafbfa] py-3.5 pl-10 pr-4 text-[14px] text-dark placeholder-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              onMouseDown={e => { e.preventDefault(); onSelect(opt.value) }}
              className={'flex w-full items-center gap-3 px-4 py-3.5 text-left text-[13.5px] transition hover:bg-primary/[0.04] ' + (i < filtered.length - 1 ? 'border-b border-border' : '')}
            >
              <span className="text-primary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4.418 0-8-5.373-8-9a8 8 0 1 1 16 0c0 3.627-3.582 9-8 9z" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span className="font-medium text-dark">{opt.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-[13px] text-muted">No locations found</p>
      )}
    </div>
  )
}

// ─── Radio row ─────────────────────────────────────────────────────────────────

function RadioRow({ opt, selected, otherText, onSelect, onOtherChange }: {
  opt: QuestionOption; selected: boolean; otherText: string
  onSelect: () => void; onOtherChange: (v: string) => void
}) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ' + (selected ? 'border-primary/40 bg-primary/[0.05] shadow-sm' : 'border-border bg-white hover:border-primary/20 hover:bg-[#fafbfa]')}
      >
        <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ' + (selected ? 'border-primary bg-primary' : 'border-gray-300')}>
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className={'text-[13.5px] font-medium ' + (selected ? 'text-dark' : 'text-dark/80')}>{opt.label}</span>
      </button>
      {selected && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input autoFocus type="text" value={otherText} onChange={e => onOtherChange(e.target.value)} placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-dark placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
        </div>
      )}
    </div>
  )
}

// ─── Checkbox row ──────────────────────────────────────────────────────────────

function CheckboxRow({ opt, checked, otherText, onToggle, onOtherChange }: {
  opt: QuestionOption; checked: boolean; otherText: string
  onToggle: () => void; onOtherChange: (v: string) => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ' + (checked ? 'border-primary/40 bg-primary/[0.05] shadow-sm' : 'border-border bg-white hover:border-primary/20 hover:bg-[#fafbfa]')}
      >
        <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ' + (checked ? 'border-primary bg-primary' : 'border-gray-300')}>
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={'text-[13.5px] font-medium ' + (checked ? 'text-dark' : 'text-dark/80')}>{opt.label}</span>
      </button>
      {checked && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input autoFocus type="text" value={otherText} onChange={e => onOtherChange(e.target.value)} placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-dark placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
        </div>
      )}
    </div>
  )
}

// ─── Wizard step ───────────────────────────────────────────────────────────────

function WizardStep({
  category, step, stepIndex, totalSteps,
  singleAnswer, multiAnswers, otherTexts,
  onSingleSelect, onMultiToggle, onOtherChange, onContinue, onBack,
}: {
  category: string; step: QuestionStep; stepIndex: number; totalSteps: number
  singleAnswer: string; multiAnswers: string[]; otherTexts: Record<string, string>
  onSingleSelect: (value: string) => void; onMultiToggle: (value: string) => void
  onOtherChange: (optValue: string, text: string) => void; onContinue: () => void; onBack: () => void
}) {
  const meta = CATEGORY_META[category]
  const Icon = CATEGORY_ICONS[category] ?? Wrench
  const isMulti = step.type === 'multi'
  const progress = ((stepIndex + 1) / totalSteps) * 100
  const canContinue = isMulti ? multiAnswers.length > 0 : singleAnswer !== ''

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-dark transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="space-y-2">
          <div className="flex justify-between text-[11.5px]">
            <span className={`flex items-center gap-1.5 font-semibold uppercase tracking-wide ${meta?.accent ?? 'text-primary'}`}>
              <Icon size={12} />{meta?.label}
            </span>
            <span className="text-muted">Step {stepIndex + 1} of {totalSteps}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-[#f0f0f0]">
            <div className="h-1 rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[1.5rem] font-bold text-dark tracking-[-0.02em]">{step.question}</h2>
        {step.hint && <p className="mt-1 text-[13.5px] text-muted">{step.hint}</p>}
      </div>

      <div className="space-y-2">
        {isMulti
          ? step.options.map(opt => (
              <CheckboxRow key={opt.value} opt={opt} checked={multiAnswers.includes(opt.value)}
                otherText={otherTexts[opt.value] ?? ''} onToggle={() => onMultiToggle(opt.value)}
                onOtherChange={v => onOtherChange(opt.value, v)} />
            ))
          : step.options.map(opt => (
              <RadioRow key={opt.value} opt={opt} selected={singleAnswer === opt.value}
                otherText={otherTexts[opt.value] ?? ''} onSelect={() => onSingleSelect(opt.value)}
                onOtherChange={v => onOtherChange(opt.value, v)} />
            ))
        }
      </div>

      {(isMulti || (singleAnswer && step.options.find(o => o.value === singleAnswer)?.allowText)) && (
        <button onClick={onContinue} disabled={!canContinue}
          className={'w-full rounded-xl py-3.5 text-[14px] font-semibold transition-all ' + (canContinue ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-[#f0f0f0] text-gray-400 cursor-not-allowed')}>
          Continue
        </button>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BookPage() {
  return <Suspense fallback={null}><BookPageInner /></Suspense>
}

function BookPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Wizard state
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [singles, setSingles]     = useState<Record<string, string>>({})
  const [multis, setMultis]       = useState<Record<string, string[]>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})

  // Browse state
  const [providers, setProviders]           = useState<any[]>([])
  const [browseCategory, setBrowseCategory] = useState<string>('all')
  const [browsing, setBrowsing]             = useState(false)

  // Fetch providers when on browse screen (no wizard active)
  useEffect(() => {
    if (category) return
    setBrowsing(true)
    supabase
      .from('provider_profiles')
      .select('id, user_id, first_name, last_name, business_name, trade_category, hourly_rate, rating_average, total_reviews, profile_image_url, service_areas, identity_verified')
      .eq('onboarding_complete', true)
      .order('rating_average', { ascending: false })
      .limit(24)
      .then(({ data }) => {
        setProviders(data ?? [])
        setBrowsing(false)
      })
  }, [category])

  const filteredProviders = browseCategory === 'all'
    ? providers
    : providers.filter(p => p.trade_category === browseCategory)

  // Wizard logic (unchanged)
  const categoryQuestions = category ? (SERVICE_QUESTIONS[category] ?? []) : []
  const steps = categoryQuestions
  const totalSteps = steps.length + 1
  const isLocationStep = stepIndex === steps.length
  const step = steps[stepIndex]

  function buildContextAndNavigate(finalSingles: Record<string, string>, finalMultis: Record<string, string[]>, island: string) {
    const meta = CATEGORY_META[category]
    const contextParts: string[] = []
    for (const [id, val] of Object.entries(finalSingles)) contextParts.push(`${id}:${val}`)
    for (const [id, vals] of Object.entries(finalMultis)) {
      if (vals.length > 0) contextParts.push(`${id}:${vals.join('|')}`)
    }
    const params = new URLSearchParams()
    if (meta?.label) params.set('category', meta.label)
    if (island) params.set('island', island)
    if (contextParts.length > 0) params.set('context', contextParts.join(','))
    router.push(`/search?${params.toString()}`)
  }

  function handleSingleSelect(questionId: string, optValue: string) {
    const opt = step?.options.find(o => o.value === optValue)
    setSingles(prev => ({ ...prev, [questionId]: optValue }))
    if (opt?.allowText) return
    setStepIndex(i => i + 1)
  }

  function handleMultiToggle(questionId: string, optValue: string) {
    setMultis(prev => {
      const cur = prev[questionId] ?? []
      const next = cur.includes(optValue) ? cur.filter(v => v !== optValue) : [...cur, optValue]
      return { ...prev, [questionId]: next }
    })
  }

  function handleOtherChange(questionId: string, optValue: string, text: string) {
    setOtherTexts(prev => ({ ...prev, [`${questionId}.${optValue}`]: text }))
  }

  function handleContinue() {
    if (!step) return
    const isMulti = step.type === 'multi'
    let newSingles = { ...singles }
    let newMultis = { ...multis }
    if (isMulti) {
      const vals = multis[step.id] ?? []
      newMultis = { ...multis, [step.id]: vals.map(v => { const opt = step.options.find(o => o.value === v); if (opt?.allowText) return otherTexts[`${step.id}.${v}`]?.trim() || v; return v }) }
    } else {
      const raw = singles[step.id] ?? ''
      const opt = step.options.find(o => o.value === raw)
      if (opt?.allowText) newSingles = { ...singles, [step.id]: otherTexts[`${step.id}.${raw}`]?.trim() || raw }
    }
    setSingles(newSingles)
    setMultis(newMultis)
    setStepIndex(i => i + 1)
  }

  function handleLocationSelect(island: string) {
    buildContextAndNavigate(singles, multis, island)
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex(i => i - 1)
    } else if (category) {
      setCategory('')
      setStepIndex(0)
      setSingles({})
      setMultis({})
      setOtherTexts({})
    }
  }

  // ── Wizard screens ────────────────────────────────────────────────────────

  if (category && isLocationStep) {
    return (
      <div className="py-8 px-4">
        <LocationSearch stepIndex={stepIndex} totalSteps={totalSteps} onSelect={handleLocationSelect} onBack={handleBack} />
      </div>
    )
  }

  if (category && step) {
    const isMulti = step.type === 'multi'
    const currentSingle = singles[step.id] ?? ''
    const currentMulti  = multis[step.id] ?? []
    return (
      <div className="py-8 px-4">
        <WizardStep
          category={category} step={step} stepIndex={stepIndex} totalSteps={totalSteps}
          singleAnswer={currentSingle} multiAnswers={currentMulti}
          otherTexts={Object.fromEntries(Object.entries(otherTexts).filter(([k]) => k.startsWith(step.id + '.')).map(([k, v]) => [k.replace(step.id + '.', ''), v]))}
          onSingleSelect={val => handleSingleSelect(step.id, val)}
          onMultiToggle={val => handleMultiToggle(step.id, val)}
          onOtherChange={(optVal, text) => handleOtherChange(step.id, optVal, text)}
          onContinue={handleContinue}
          onBack={handleBack}
        />
      </div>
    )
  }

  // ── Browse screen (default) ───────────────────────────────────────────────

  return (
    <div className="space-y-10 pb-10">

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">What do you need done?</h1>
        <p className="mt-1 text-sm text-gray-500">Pick a service and we'll find the right pro — or browse providers directly below.</p>
      </div>

      {/* Category tiles — clicking starts the wizard */}
      <section>
        <CategoryPicker onPick={cat => { setCategory(cat); setStepIndex(0) }} />
      </section>

      {/* Provider browse */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Browse providers</h2>
          <Link href="/search" className="text-sm text-primary hover:underline">See all →</Link>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          <button
            onClick={() => setBrowseCategory('all')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${browseCategory === 'all' ? 'bg-gray-900 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </button>
          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setBrowseCategory(key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${browseCategory === key ? 'bg-gray-900 text-white' : 'bg-white ring-1 ring-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>

        {browsing ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-2xl bg-gray-50">
            <p className="text-sm text-gray-400">No providers found in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProviders.map(p => <ProviderBrowseCard key={p.id} provider={p} />)}
          </div>
        )}
      </section>
    </div>
  )
}
