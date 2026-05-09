'use client'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useActiveRole } from '@/hooks/useActiveRole'

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { activeRole } = useActiveRole()

  const items = [
    { label: 'Profile', description: 'Update your name and contact info', href: '/settings/profile' },
    { label: 'Manage Roles', description: 'Add or switch between your roles', href: '/settings/roles' },
    { label: 'Security', description: 'Change your password', href: '/settings/security' },
    { label: 'Billing', description: 'Payment methods and history', href: '/settings/billing' },
    { label: 'Help', description: 'FAQs and support', href: '/help' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <p className="font-medium text-gray-900">{user?.email}</p>
        <p className="text-sm text-gray-500 capitalize">Active role: {activeRole}</p>
      </div>

      <div className="space-y-1 rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
        {items.map((item, i) => (
          <Link key={item.label} href={item.href} className={'flex items-center justify-between p-4 transition hover:bg-gray-50 ' + (i > 0 ? 'border-t border-gray-100' : '')}>
            <div>
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        ))}
      </div>

      <button onClick={signOut} className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 hover:bg-red-50">
        Sign Out
      </button>
    </div>
  )
}
