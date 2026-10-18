'use client'
import Link from 'next/link'

export default function AdminSettingsPage() {
  // Placeholder rows ("Service Categories", "Service Areas") linked to # —
  // removed until those editors exist (Phase 8)
  const items = [
    { label: 'Disputes & payouts', description: 'Dispute window and provider payout clearing delays', href: '/admin/settings/payments' },
    { label: 'Commission Rates', description: 'Adjust platform commission rates by service type', href: '/admin/settings/commission-rates' },
  ]
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
      <div className="space-y-3">
        {items.map(item => (
          <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30">
            <div><p className="font-semibold text-gray-900">{item.label}</p><p className="text-sm text-gray-500">{item.description}</p></div>
            <span className="text-gray-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
