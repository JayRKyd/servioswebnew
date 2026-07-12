import Link from 'next/link'

export const metadata = { title: 'Coming Soon — Servios' }

export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-3xl">
          🏠
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coming Soon</h1>
          <p className="mt-3 text-gray-500">
            Landlord and tenant features are launching in Phase 2.
            We&apos;re putting the finishing touches on property management,
            tenant communication, and maintenance tracking.
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 text-left space-y-3">
          <p className="text-sm font-semibold text-gray-900">Phase 2 includes:</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              'Property management dashboard',
              'Tenant portal & lease tracking',
              'Maintenance request workflow',
              'Compliance tracking',
              'Preferred provider network',
              'Before/after photo documentation',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-gray-400">
          In the meantime, you can still book services as a{' '}
          <strong className="text-gray-600">Customer</strong> or offer your services as a{' '}
          <strong className="text-gray-600">Provider</strong>.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-dark">
            Go to Dashboard
          </Link>
          <Link href="/login" className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
