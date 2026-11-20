import { Check } from 'lucide-react'

interface Props {
  status: string
  /** authorized | paid | partially_refunded | refunded | unpaid … */
  paymentStatus?: string | null
  confirmed: boolean
  /** £0 bookings skip the payment step */
  hasAmount: boolean
}

/** Where a booking is and what comes next — the same six steps for both
 *  sides (client Round 6 design note 10). Cancelled / declined bookings
 *  don't render a stepper. On a phone six labels don't fit on one line, so
 *  the dots stand alone and the current step is named underneath. */
export function BookingStepper({ status, paymentStatus, confirmed, hasAmount }: Props) {
  if (['cancelled', 'rejected'].includes(status)) return null
  const paid = ['authorized', 'paid', 'succeeded', 'partially_refunded', 'refunded'].includes(paymentStatus ?? '')
  const steps = [
    { label: 'Requested', done: true },
    { label: 'Accepted', done: ['accepted', 'in_progress', 'completed'].includes(status) },
    ...(hasAmount ? [{ label: 'Payment secured', done: paid }] : []),
    { label: 'In progress', done: ['in_progress', 'completed'].includes(status) },
    { label: 'Work done', done: status === 'completed' },
    { label: 'Confirmed', done: confirmed },
  ]
  const current = steps.findIndex(s => !s.done)
  const allDone = current === -1
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
      <ol className="flex items-center" aria-label="Booking progress">
        {steps.map((s, i) => (
          <li key={s.label} className="flex min-w-0 flex-1 items-center last:flex-none" aria-current={i === current ? 'step' : undefined}>
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                s.done ? 'bg-green-600 text-white' : i === current ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-gray-100 text-gray-400'
              }`}>
                {s.done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`hidden whitespace-nowrap text-[11px] font-semibold lg:inline ${s.done ? 'text-gray-700' : i === current ? 'text-primary' : 'text-gray-400'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={`mx-1.5 h-px min-w-[8px] flex-1 lg:mx-2 ${s.done ? 'bg-green-300' : 'bg-gray-200'}`} />}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-gray-500 lg:hidden">
        {allDone
          ? <span className="font-semibold text-green-700">All {steps.length} steps done · Confirmed</span>
          : <>Step {current + 1} of {steps.length} · <span className="font-semibold text-primary">{steps[current].label}</span>{current > 0 ? <span className="text-gray-400"> · after {steps[current - 1].label.toLowerCase()}</span> : null}</>}
      </p>
    </div>
  )
}
