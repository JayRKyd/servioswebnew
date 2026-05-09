'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Droplets, Zap, Wind, Paintbrush, Hammer, Sparkles, Leaf, Home, Bug, Shield, Wrench } from 'lucide-react'
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

// ─── Category picker ───────────────────────────────────────────────────────

function CategoryPicker({ onPick }: { onPick: (cat: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-[1.75rem] font-bold text-dark tracking-[-0.02em]">What service do you need?</h1>
        <p className="mt-2 text-[14.5px] text-muted">Pick a category — we'll match you with the best providers.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = CATEGORY_ICONS[key] ?? Wrench
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-5 text-center transition-all hover:border-primary/30 hover:shadow-[0_4px_16px_rgba(17,94,86,0.08)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f4f5f4] transition-colors group-hover:bg-primary/[0.08]">
                <Icon size={20} className="text-muted transition-colors group-hover:text-primary" />
              </div>
              <span className="text-[13px] font-semibold text-dark">{meta.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Location search step ──────────────────────────────────────────────────

function LocationSearch({
  stepIndex,
  totalSteps,
  onSelect,
  onBack,
}: {
  stepIndex: number
  totalSteps: number
  onSelect: (value: string) => void
  onBack: () => void
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
          autoFocus
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
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
              className={
                'flex w-full items-center gap-3 px-4 py-3.5 text-left text-[13.5px] transition hover:bg-primary/[0.04] ' +
                (i < filtered.length - 1 ? 'border-b border-border' : '')
              }
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

// ─── Single option row ─────────────────────────────────────────────────────

function RadioRow({
  opt, selected, otherText, onSelect, onOtherChange,
}: {
  opt: QuestionOption
  selected: boolean
  otherText: string
  onSelect: () => void
  onOtherChange: (v: string) => void
}) {
  return (
    <div>
      <button
        onClick={onSelect}
        className={
          'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ' +
          (selected
            ? 'border-primary/40 bg-primary/[0.05] shadow-sm'
            : 'border-border bg-white hover:border-primary/20 hover:bg-[#fafbfa]')
        }
      >
        <span className={
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ' +
          (selected ? 'border-primary bg-primary' : 'border-gray-300')
        }>
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
        <span className={'text-[13.5px] font-medium ' + (selected ? 'text-dark' : 'text-dark/80')}>
          {opt.label}
        </span>
      </button>

      {selected && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input
            autoFocus
            type="text"
            value={otherText}
            onChange={e => onOtherChange(e.target.value)}
            placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-dark placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
      )}
    </div>
  )
}

// ─── Checkbox option row ───────────────────────────────────────────────────

function CheckboxRow({
  opt, checked, otherText, onToggle, onOtherChange,
}: {
  opt: QuestionOption
  checked: boolean
  otherText: string
  onToggle: () => void
  onOtherChange: (v: string) => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={
          'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ' +
          (checked
            ? 'border-primary/40 bg-primary/[0.05] shadow-sm'
            : 'border-border bg-white hover:border-primary/20 hover:bg-[#fafbfa]')
        }
      >
        <span className={
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ' +
          (checked ? 'border-primary bg-primary' : 'border-gray-300')
        }>
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className={'text-[13.5px] font-medium ' + (checked ? 'text-dark' : 'text-dark/80')}>
          {opt.label}
        </span>
      </button>

      {checked && opt.allowText && (
        <div className="mt-1.5 px-1">
          <input
            autoFocus
            type="text"
            value={otherText}
            onChange={e => onOtherChange(e.target.value)}
            placeholder="Please describe…"
            className="w-full rounded-xl border border-primary/30 bg-white px-3.5 py-3 text-[13.5px] text-dark placeholder-gray-400 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
      )}
    </div>
  )
}

// ─── Question wizard step ─────────────────────────────────────────────────

function WizardStep({
  category, step, stepIndex, totalSteps,
  singleAnswer, multiAnswers, otherTexts,
  onSingleSelect, onMultiToggle, onOtherChange, onContinue, onBack,
}: {
  category: string
  step: QuestionStep
  stepIndex: number
  totalSteps: number
  singleAnswer: string
  multiAnswers: string[]
  otherTexts: Record<string, string>
  onSingleSelect: (value: string) => void
  onMultiToggle: (value: string) => void
  onOtherChange: (optValue: string, text: string) => void
  onContinue: () => void
  onBack: () => void
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
            <span className="flex items-center gap-1.5 font-semibold text-primary uppercase tracking-wide">
              <Icon size={12} />
              {meta?.label}
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
              <CheckboxRow
                key={opt.value}
                opt={opt}
                checked={multiAnswers.includes(opt.value)}
                otherText={otherTexts[opt.value] ?? ''}
                onToggle={() => onMultiToggle(opt.value)}
                onOtherChange={v => onOtherChange(opt.value, v)}
              />
            ))
          : step.options.map(opt => (
              <RadioRow
                key={opt.value}
                opt={opt}
                selected={singleAnswer === opt.value}
                otherText={otherTexts[opt.value] ?? ''}
                onSelect={() => onSingleSelect(opt.value)}
                onOtherChange={v => onOtherChange(opt.value, v)}
              />
            ))
        }
      </div>

      {(isMulti || (singleAnswer && step.options.find(o => o.value === singleAnswer)?.allowText)) && (
        <button
          onClick={onContinue}
          disabled={!canContinue}
          className={
            'w-full rounded-xl py-3.5 text-[14px] font-semibold transition-all ' +
            (canContinue
              ? 'bg-primary text-white hover:bg-primary-dark'
              : 'bg-[#f0f0f0] text-gray-400 cursor-not-allowed')
          }
        >
          Continue
        </button>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function BookPage() {
  return <Suspense fallback={null}><BookPageInner /></Suspense>
}
function BookPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [stepIndex, setStepIndex] = useState(0)
  const [singles, setSingles]     = useState<Record<string, string>>({})
  const [multis, setMultis]       = useState<Record<string, string[]>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})

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
      newMultis = {
        ...multis,
        [step.id]: vals.map(v => {
          const opt = step.options.find(o => o.value === v)
          if (opt?.allowText) return otherTexts[`${step.id}.${v}`]?.trim() || v
          return v
        }),
      }
    } else {
      const raw = singles[step.id] ?? ''
      const opt = step.options.find(o => o.value === raw)
      if (opt?.allowText) {
        newSingles = { ...singles, [step.id]: otherTexts[`${step.id}.${raw}`]?.trim() || raw }
      }
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

  if (!category) {
    return (
      <div className="py-8 px-4">
        <CategoryPicker onPick={cat => { setCategory(cat); setStepIndex(0) }} />
      </div>
    )
  }

  if (isLocationStep) {
    return (
      <div className="py-8 px-4">
        <LocationSearch
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          onSelect={handleLocationSelect}
          onBack={handleBack}
        />
      </div>
    )
  }

  if (!step) return null

  const isMulti = step.type === 'multi'
  const currentSingle = singles[step.id] ?? ''
  const currentMulti  = multis[step.id] ?? []

  return (
    <div className="py-8 px-4">
      <WizardStep
        category={category}
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        singleAnswer={currentSingle}
        multiAnswers={currentMulti}
        otherTexts={
          Object.fromEntries(
            Object.entries(otherTexts)
              .filter(([k]) => k.startsWith(step.id + '.'))
              .map(([k, v]) => [k.replace(step.id + '.', ''), v])
          )
        }
        onSingleSelect={val => handleSingleSelect(step.id, val)}
        onMultiToggle={val => handleMultiToggle(step.id, val)}
        onOtherChange={(optVal, text) => handleOtherChange(step.id, optVal, text)}
        onContinue={handleContinue}
        onBack={handleBack}
      />
    </div>
  )
}
