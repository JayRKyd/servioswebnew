'use client'
import Link from 'next/link'
import { useActiveRole } from '@/hooks/useActiveRole'
import { useSwitchRole } from '@/hooks/useSwitchRole'
import type { Role } from '@/lib/permissions'

const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  customer: { label: 'Customer', description: 'Book services from verified providers' },
  provider: { label: 'Service Provider', description: 'Offer and manage your services' },
  landlord: { label: 'Landlord', description: 'Manage properties and tenants' },
  tenant: { label: 'Tenant', description: 'Access your property and communicate with landlord' },
  admin: { label: 'Administrator', description: 'Manage platform users and settings' },
}

export default function ManageRolesPage() {
  const { activeRole, availableRoles } = useActiveRole()
  const { switchRole, isPending, error } = useSwitchRole()

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Roles</h1>

      <div className="space-y-3">
        {availableRoles.map(role => {
          const info = ROLE_INFO[role]
          const isActive = role === activeRole
          return (
            <div key={role} className={'rounded-xl bg-white p-4 shadow-sm ring-1 ' + (isActive ? 'ring-blue-400 bg-primary/[0.06]' : 'ring-gray-100')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{info.label}</p>
                  <p className="text-sm text-gray-500">{info.description}</p>
                </div>
                {isActive ? (
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">Active</span>
                ) : (
                  <button onClick={() => switchRole(role)} disabled={isPending}
                    className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/[0.06] disabled:opacity-50">
                    Switch
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Link href="/settings/roles/add" className="block w-full rounded-xl border-2 border-dashed border-gray-200 py-4 text-center text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-primary transition">
        + Add a Role
      </Link>
    </div>
  )
}
