import Link from 'next/link'

export default function SetupCompletePage() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center space-y-6">
      <div className="text-6xl">🎉</div>
      <h1 className="text-3xl font-bold text-gray-900">Application Submitted!</h1>
      <p className="text-gray-500 text-lg leading-relaxed">
        Your profile and documents are under review. We'll notify you once your account is verified — usually within 24–48 hours.
      </p>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-6 text-left space-y-3">
        {[
          { icon: '✅', label: 'Trade category saved' },
          { icon: '✅', label: 'Services configured' },
          { icon: '✅', label: 'Documents uploaded' },
          { icon: '⏳', label: 'Awaiting admin verification' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-lg">{item.icon}</span>
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
