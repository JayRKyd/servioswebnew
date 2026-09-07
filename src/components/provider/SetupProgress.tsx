import { Check } from 'lucide-react'

const STEPS = ['Trade', 'Services', 'Availability', 'Documents']

/** Progress header shared by the provider setup steps. `current` is the
 *  0-based index into Trade → Services → Availability → Documents. */
export function SetupProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 shrink-0">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= current ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
            {i < current ? <Check size={13} strokeWidth={3} /> : i + 1}
          </div>
          <span className={`text-sm ${i === current ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-8 bg-gray-200" />}
        </div>
      ))}
    </div>
  )
}
