import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'

export default function SetupCompletePage() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 size={34} className="text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900">Application Submitted!</h1>
      <p className="text-gray-500 text-lg leading-relaxed">
        Your profile and documents are under review. We'll notify you once your account is verified — usually within 24–48 hours.
      </p>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-6 text-left space-y-3">
        {[
          { done: true, label: 'Trade category saved' },
          { done: true, label: 'Services configured' },
          { done: true, label: 'Documents uploaded' },
          { done: false, label: 'Awaiting admin verification' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.done
              ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              : <Clock size={18} className="text-amber-500 shrink-0" />}
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-primary/[0.06] p-4 text-sm text-primary">
        You'll receive an email and push notification once you're verified and can start accepting jobs.
      </div>

      <Link href="/provider" className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark">
        View My Dashboard
      </Link>
    </div>
  )
}
