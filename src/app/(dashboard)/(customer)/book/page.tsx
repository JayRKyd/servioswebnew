'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Droplets, Zap, Wind, Paintbrush, Hammer, Sparkles, Leaf, Home, Bug, Shield, Wrench, MapPin, Search } from 'lucide-react'
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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  plumber: ['plumb', 'boiler', 'pipe', 'tap', 'toilet', 'drain', 'leak'],
  electrician: ['electric', 'socket', 'wiring', 'light', 'power'],
  hvac: ['hvac', 'heating', 'air conditioning', 'radiator'],
  painter: ['paint', 'decorat'],
  carpenter: ['carpent', 'woodwork', 'cabinet'],
  cleaner: ['clean', 'tenancy'],
  landscaper: ['garden', 'landscap', 'lawn', 'hedge'],
  roofer: ['roof', 'gutter'],
  pest_control: ['pest', 'rat', 'mouse', 'mice', 'insect'],
  security: ['security', 'alarm', 'lock', 'cctv'],
  handyman: ['handyman', 'flat-pack', 'assembly', 'mount', 'repair'],
}

function inferCategory(query: string): string {
  const normalized = query.toLowerCase()
  return Object.entries(CATEGORY_KEYWORDS).find(([, words]) =>
    words.some(word => normalized.includes(word))
  )?.[0] ?? ''
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
    <div className="fixed top-[64px] left-0 lg:left-[220px] right-0 bottom-0 z-40 flex">
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
        {/* Segmented step progress bar */}
        <div className="flex gap-1.5 px-6 lg:px-16 pt-5 shrink-0">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={'h-1.5 flex-1 rounded-full transition-all duration-300 ' + (i <= stepIndex ? 'bg-primary' : 'bg-gray-200')}
            />
          ))}
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
    <div className="fixed top-[64px] left-0 lg:left-[220px] right-0 bottom-0 z-40 flex">
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
        {/* Segmented step progress bar */}
        <div className="flex gap-1.5 px-6 lg:px-16 pt-5 shrink-0">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={'h-1.5 flex-1 rounded-full transition-all duration-300 ' + (i <= stepIndex ? 'bg-primary' : 'bg-gray-200')}
            />
          ))}
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
  const jobQuery = searchParams.get('query')?.trim() ?? ''

  // Wizard state
  const [category, setCategory] = useState(searchParams.get('category') ?? inferCategory(jobQuery))
  const [stepIndex, setStepIndex] = useState(0)
  const [singles, setSingles]     = useState<Record<string, string>>({})
  const [multis, setMultis]       = useState<Record<string, string[]>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})

  // Wizard logic
  const categoryQuestions = category ? (SERVICE_QUESTIONS[category] ?? []) : []
  const steps = categoryQuestions
  const totalSteps = steps.length + 1
  const isLocationStep = stepIndex === steps.length
  const step = steps[stepIndex]

  function buildContextAndNavigate(finalSingles: Record<string, string>, finalMultis: Record<string, string[]>, island: string) {
    const meta = CATEGORY_META[category]

    // Serialize answers as readable labels — this string ends up verbatim in
    // the provider-facing booking notes, so no machine keys or values.
    const stepById = (id: string) => steps.find(s => s.id === id)
    const questionTitle = (id: string) => {
      const spaced = id.replace(/_/g, ' ')
      return spaced.charAt(0).toUpperCase() + spaced.slice(1)
    }
    const labelFor = (id: string, val: string) =>
      stepById(id)?.options.find(o => o.value === val)?.label ?? val // free text passes through

    const contextParts: string[] = []
    for (const [id, val] of Object.entries(finalSingles)) {
      contextParts.push(`${questionTitle(id)}: ${labelFor(id, val)}`)
    }
    for (const [id, vals] of Object.entries(finalMultis)) {
      if (vals.length > 0) contextParts.push(`${questionTitle(id)}: ${vals.map(v => labelFor(id, v)).join(', ')}`)
    }
    if (jobQuery) contextParts.unshift(`Request: ${jobQuery}`)

    const params = new URLSearchParams()
    if (meta?.label) params.set('category', meta.label)
    if (island) params.set('island', island)
    if (contextParts.length > 0) params.set('context', contextParts.join(' · '))
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
    return <LocationSearch stepIndex={stepIndex} totalSteps={totalSteps} onSelect={handleLocationSelect} onBack={handleBack} />
  }

  if (category && step) {
    const isMulti = step.type === 'multi'
    const currentSingle = singles[step.id] ?? ''
    const currentMulti  = multis[step.id] ?? []
    return (
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
    )
  }

  // ── Category selection (default) ──────────────────────────────────────────

  return (
    <div className="space-y-10 pb-10">

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Get Quotes</h1>
        <p className="mt-1 text-sm text-gray-500">Answer a few quick questions and we'll match you with the right pro.</p>
      </div>

      {jobQuery && (
        <div className="rounded-xl bg-primary/[0.06] px-4 py-3 text-sm text-primary ring-1 ring-primary/10">
          Your request: <span className="font-semibold">{jobQuery}</span>
        </div>
      )}

      {/* Category tiles — clicking starts the wizard */}
      <section>
        <CategoryPicker onPick={cat => { setCategory(cat); setStepIndex(0) }} />
      </section>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-dark">Prefer to choose a provider yourself?</p>
          <p className="mt-1 text-xs text-muted">Skip the quote questions and compare providers directly.</p>
        </div>
        <Link href="/search" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/[0.05]">
          <Search size={14} /> Browse Providers
        </Link>
      </div>
    </div>
  )
}
