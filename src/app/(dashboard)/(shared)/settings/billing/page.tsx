'use client'
export default function BillingPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No payment methods added</p>
          <p className="text-xs text-gray-400">Saved payment methods arrive with online payments — coming soon.</p>
        </div>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Billing History</h2>
        <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-400">No billing history</p>
        </div>
      </div>
    </div>
  )
}
