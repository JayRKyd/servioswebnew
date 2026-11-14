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
 *  don't render a stepper. */
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
  return (
    <ol className="flex items-center overflow-x-auto rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100" aria-label="Booking progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex min-w-0 flex-1 items-center last:flex-none">
          <div className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              s.done ? 'bg-green-600 text-white' : i === current ? 'bg-primary text-white ring-4 ring-primary/15' : 'bg-gray-100 text-gray-400'
            }`}>
              {s.done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`whitespace-nowrap text-[11px] font-semibold ${s.done ? 'text-gray-700' : i === current ? 'text-primary' : 'text-gray-400'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className={`mx-2 h-px min-w-[12px] flex-1 ${s.done ? 'bg-green-300' : 'bg-gray-200'}`} />}
        </li>
      ))}
    </ol>
  )
}
