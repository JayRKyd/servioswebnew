'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'

type ConnectStatus = {
  connected: boolean
  status: 'not_connected' | 'pending' | 'active' | 'restricted'
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
  detailsSubmitted?: boolean
  accountId?: string
  requirements?: {
    currently_due?: string[]
    eventually_due?: string[]
    errors?: { requirement: string; reason: string }[]
  }
}

export default function ProviderPayoutsPage() {
  return <Suspense fallback={null}><ProviderPayoutsInner /></Suspense>
}

function ProviderPayoutsInner() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const successParam = searchParams.get('success')
  const refreshParam = searchParams.get('refresh')

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await apiClient<ConnectStatus>('/api/v1/connect/status')
    if (err) setError(err)
    else setStatus(data)
    setLoading(false)
  }

  async function handleOnboard() {
    setOnboarding(true)
    setError(null)
    const { data, error: err } = await apiClient<{ url: string }>('/api/v1/connect/onboard', { method: 'POST' })
    if (err) { setError(err); setOnboarding(false); return }
    window.location.href = data!.url
  }

  async function handleDashboard() {
    setDashboardLoading(true)
    setError(null)
    const { data, error: err } = await apiClient<{ url: string }>('/api/v1/connect/dashboard', { method: 'POST' })
    if (err) { setError(err); setDashboardLoading(false); return }
    window.open(data!.url, '_blank')
    setDashboardLoading(false)
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>

      {successParam && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200">
          <p className="font-medium">Stripe setup complete!</p>
          <p className="mt-0.5 text-green-700">
            Your account is now being verified. You'll be notified once you can receive payouts.
          </p>
        </div>
      )}

      {refreshParam && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="font-medium">Onboarding not completed</p>
          <p className="mt-0.5 text-amber-700">
            Your Stripe onboarding link expired. Click Continue Onboarding below to try again.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Status card */}
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stripe Connect</h2>
            <p className="mt-1 text-sm text-gray-500">
              Servios uses Stripe to pay you directly into your bank account after each completed job.
            </p>
          </div>
          <StatusBadge status={status?.status ?? 'not_connected'} />
        </div>

        {status?.status === 'not_connected' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connect your bank account to start receiving payments. This takes about 5 minutes.
            </p>
            <ul className="text-sm text-gray-500 list-disc list-inside space-y-1">
              <li>Verify your identity and business details</li>
              <li>Add your bank account for payouts</li>
              <li>Funds are released after each job is completed</li>
            </ul>
            <button
              onClick={handleOnboard}
              disabled={onboarding}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {onboarding ? 'Redirecting to Stripe…' : 'Connect Bank Account'}
            </button>
          </div>
        )}

        {status?.status === 'pending' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Your Stripe account setup is incomplete. Finish onboarding to receive payouts.
            </p>
            {status.requirements?.currently_due && status.requirements.currently_due.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                <p className="font-medium mb-1">Information required:</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                  {status.requirements.currently_due.map((r) => (
                    <li key={r} className="font-mono text-xs">{r.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={handleOnboard}
              disabled={onboarding}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {onboarding ? 'Redirecting to Stripe…' : 'Continue Onboarding'}
            </button>
          </div>
        )}

        {status?.status === 'active' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Capability label="Charges" enabled={status.chargesEnabled ?? false} />
              <Capability label="Payouts" enabled={status.payoutsEnabled ?? false} />
              <Capability label="Verified" enabled={status.detailsSubmitted ?? false} />
            </div>
            <p className="text-sm text-gray-500">
              Your Stripe account is fully active. Funds are transferred to your bank account
              automatically after each job is marked complete.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDashboard}
                disabled={dashboardLoading}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {dashboardLoading ? 'Opening…' : 'View Stripe Dashboard'}
              </button>
              <button
                onClick={fetchStatus}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
      </section>

      {/* How payouts work */}
      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">How payouts work</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          {[
            ['Customer pays', 'When a customer pays for a booking, funds are held in escrow — not transferred to you yet.'],
            ['Job completed', 'Once the job is marked complete and the customer confirms, the escrow is released.'],
            ['Funds transferred', 'Your earnings (minus platform commission) are transferred to your Stripe account.'],
            ['Bank payout', 'Stripe sends the money to your linked bank account, typically within 2 business days.'],
          ].map(([step, desc], i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-gray-800">{step}</p>
                <p className="text-gray-500">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    not_connected: 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-green-100 text-green-700',
    restricted: 'bg-red-100 text-red-600',
  }
  const labels: Record<string, string> = {
    not_connected: 'Not connected',
    pending: 'Setup incomplete',
    active: 'Active',
    restricted: 'Restricted',
  }
  return (
    <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + (styles[status] ?? styles.not_connected)}>
      {labels[status] ?? status}
    </span>
  )
}

function Capability({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
        {enabled ? 'Enabled' : 'Pending'}
      </p>
    </div>
  )
}
