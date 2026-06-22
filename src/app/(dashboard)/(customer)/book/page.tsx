'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Droplets, Zap, Wind, Paintbrush, Hammer, Sparkles, Leaf, Home, Bug, Shield, Wrench, Star, BadgeCheck, MapPin } from 'lucide-react'
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
  const initial = displayName.charAt(0).toUpperCase()
  const meta = provider.trade_category ? CATEGORY_META[provider.trade_category] : null

  return (
    <Link href={`/providers/${provider.user_id}`} className="group block">
      {/* Photo / avatar area */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface group-hover:shadow-md transition-all duration-200">
        {provider.profile_image_url ? (
          <img
            src={provider.profile_image_url}
            alt={displayName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/[0.10] to-primary/[0.20]">
            <span className="text-6xl font-bold text-primary/25 select-none">{initial}</span>
          </div>
        )}
        {/* Verified chip — bottom-left */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 shadow-sm">
          <BadgeCheck size={11} className="text-primary" />
          <span className="text-[11px] font-semibold text-primary">Verified</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 px-0.5 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-dark truncate leading-snug">{displayName}</p>
          {provider.rating_average > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-dark">
              <Star size={11} className="fill-dark stroke-dark" />
              {Number(provider.rating_average).toFixed(1)}
            </span>
          )}
        </div>
        {meta && <p className="text-xs text-muted capitalize">{meta.label}</p>}
        {provider.service_areas?.length > 0 && (
          <p className="text-xs text-muted">{provider.service_areas.slice(0, 2).join(', ')}</p>
        )}
        {provider.total_reviews > 0 && (
          <p className="text-xs text-muted">{provider.total_reviews} review{provider.total_reviews !== 1 ? 's' : ''}</p>
        )}
        {provider.hourly_rate != null && (
          <p className="text-sm font-semibold text-dark pt-1">
            <span className="font-normal text-muted text-xs">From </span>£{provider.hourly_rate}/hr
          </p>
        )}
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
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 text-center transition-all hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(17,94,86,0.08)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface transition-colors group-hover:bg-primary/[0.08]">
              <Icon size={20} className="text-muted transition-colors group-hover:text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-dark">{meta.label}</p>
              <p className="text-[11px] text-muted mt-0.5">Tap to get matched</p>
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

  return (
    <div
      className="-mx-10 -mt-14 lg:-mx-12 lg:-mt-16 flex"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-[280px] xl:w-[340px] shrink-0 flex-col bg-gradient-to-br from-primary to-primary/80 px-8 py-10">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Center content */}
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <MapPin size={28} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">Location</p>
            <p className="text-sm text-white/60 mt-2 leading-relaxed">
              We'll show you providers in your area
            </p>
          </div>
        </div>

        {/* Step indicator pills */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={
                'rounded-full transition-all ' +
                (i === stepIndex
                  ? 'w-8 h-1.5 bg-white'
                  : i < stepIndex
                  ? 'w-3 h-1.5 bg-white/50'
                  : 'w-3 h-1.5 bg-white/25')
              }
            />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Thin progress bar */}
        <div className="h-0.5 w-full bg-gray-100 shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Mobile-only header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 lg:hidden shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="text-[13px] text-gray-500">
            Location · Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 lg:px-16 py-10">
          <div className="max-w-xl">
            {/* Step label — desktop only */}
            <p className="hidden lg:block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Location
            </p>

            {/* Question */}
            <h2 className="text-2xl lg:text-[2rem] font-bold text-gray-900 tracking-tight leading-tight mb-2">
              Where do you need the service?
            </h2>

            {/* Hint */}
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              We'll show you providers in your area
            </p>

            {/* Search input */}
            <div className="relative mb-6">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
              <input
                autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search city…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3.5 pl-10 pr-4 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            {/* Results */}
            {filtered.length > 0 ? (
              <div className="space-y-2.5">
                {filtered.map(opt => (
                  <button
                    key={opt.value}
                    onMouseDown={e => { e.preventDefault(); onSelect(opt.value) }}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-5 py-4 text-left text-[14px] transition-all hover:border-primary/40 hover:bg-primary/[0.04]"
                  >
                    <MapPin size={16} className="text-primary shrink-0" />
                    <span className="font-medium text-gray-800">{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-[13px] text-gray-400">No locations found</p>
            )}
          </div>
        </div>
      </div>
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
        className={
          'flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-all ' +
          (selected
            ? 'border-primary bg-primary/[0.04] shadow-sm'
            : 'border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]')
        }
      >
        {/* Custom radio circle */}
        <span
          className={
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ' +
            (selected ? 'border-primary bg-primary' : 'border-gray-300')
          }
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className="text-[14px] font-medium text-gray-800">{opt.label}</span>
      </button>
      {selected && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input
            autoFocus type="text" value={otherText} onChange={e => onOtherChange(e.target.value)}
            placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-gray-900 placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
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
        className={
          'flex w-full items-center gap-3 rounded-xl border px-5 py-4 text-left transition-all ' +
          (checked
            ? 'border-primary bg-primary/[0.04] shadow-sm'
            : 'border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/[0.02]')
        }
      >
        {/* Custom rounded-md checkbox */}
        <span
          className={
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ' +
            (checked ? 'border-primary bg-primary' : 'border-gray-300')
          }
        >
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="text-[14px] font-medium text-gray-800">{opt.label}</span>
      </button>
      {checked && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input
            autoFocus type="text" value={otherText} onChange={e => onOtherChange(e.target.value)}
            placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-gray-900 placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
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
  const canContinue = isMulti ? multiAnswers.length > 0 : singleAnswer !== ''

  return (
    <div
      className="-mx-10 -mt-14 lg:-mx-12 lg:-mt-16 flex"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-[280px] xl:w-[340px] shrink-0 flex-col bg-gradient-to-br from-primary to-primary/80 px-8 py-10">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Center content */}
        <div className="flex flex-1 flex-col justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <Icon size={28} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{meta?.label ?? category}</p>
            <p className="text-sm text-white/60 mt-2 leading-relaxed">
              {step.hint ?? 'Tell us a bit more so we can match you with the right pro.'}
            </p>
          </div>
        </div>

        {/* Step indicator pills */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={
                'rounded-full transition-all ' +
                (i === stepIndex
                  ? 'w-8 h-1.5 bg-white'
                  : i < stepIndex
                  ? 'w-3 h-1.5 bg-white/50'
                  : 'w-3 h-1.5 bg-white/25')
              }
            />
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Thin progress bar */}
        <div className="h-0.5 w-full bg-gray-100 shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Mobile-only header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 lg:hidden shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <span className="text-[13px] text-gray-500">
            {meta?.label ?? category} · Step {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 lg:px-16 py-10">
          <div className="max-w-xl">
            {/* Step label — desktop only */}
            <p className="hidden lg:block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {meta?.label ?? category} · Step {stepIndex + 1} of {totalSteps}
            </p>

            {/* Question */}
            <h2 className="text-2xl lg:text-[2rem] font-bold text-gray-900 tracking-tight leading-tight mb-2">
              {step.question}
            </h2>

            {/* Hint */}
            {step.hint && (
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">{step.hint}</p>
            )}
            {!step.hint && <div className="mb-8" />}

            {/* Options */}
            <div className="space-y-2.5">
              {isMulti
                ? step.options.map(opt => (
                    <CheckboxRow
                      key={opt.value} opt={opt} checked={multiAnswers.includes(opt.value)}
                      otherText={otherTexts[opt.value] ?? ''} onToggle={() => onMultiToggle(opt.value)}
                      onOtherChange={v => onOtherChange(opt.value, v)}
                    />
                  ))
                : step.options.map(opt => (
                    <RadioRow
                      key={opt.value} opt={opt} selected={singleAnswer === opt.value}
                      otherText={otherTexts[opt.value] ?? ''} onSelect={() => onSingleSelect(opt.value)}
                      onOtherChange={v => onOtherChange(opt.value, v)}
                    />
                  ))
              }
            </div>
          </div>
        </div>

        {/* Footer — multi or allowText single */}
        {(isMulti || (singleAnswer && step.options.find(o => o.value === singleAnswer)?.allowText)) && (
          <div className="shrink-0 border-t border-gray-100 px-8 lg:px-16 py-5">
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className={
                'w-full rounded-xl py-3.5 text-[14px] font-semibold transition-all ' +
                (canContinue
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed')
              }
            >
              Continue
            </button>
          </div>
        )}
      </div>
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
              {meta.label}
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
