'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useActiveRole } from '@/hooks/useActiveRole'
import type { Role } from '@/lib/permissions'

const LANDLORD_TENANT_ENABLED = process.env.NEXT_PUBLIC_LANDLORD_TENANT_ENABLED === 'true'

const ROLE_OPTIONS: { role: Role; label: string; description: string }[] = [
  { role: 'customer', label: 'Customer', description: 'Book home and property services' },
  { role: 'provider', label: 'Service Provider', description: 'Offer your services on the platform' },
  ...(LANDLORD_TENANT_ENABLED
    ? [
        { role: 'landlord' as Role, label: 'Landlord', description: 'Manage your rental properties' },
        { role: 'tenant' as Role, label: 'Tenant', description: 'Access your rented property' },
      ]
    : []),
]

export default function AddRolePage() {
  const { user } = useAuth()
  const { availableRoles } = useActiveRole()
  const router = useRouter()
  const [selected, setSelected] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addable = ROLE_OPTIONS.filter(o => !availableRoles.includes(o.role))

  async function handleAdd() {
    if (!user || !selected) return
    setSaving(true)
    setError(null)

    // Server route updates the users table, the auth metadata, and creates
    // the role's profile row — the client can't (and shouldn't) do these.
    const res = await fetch('/api/auth/add-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selected }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? 'Failed to add role')
      setSaving(false)
      return
    }

    // Pick up the new metadata so the role appears everywhere immediately
    await supabase.auth.refreshSession()
    router.push('/settings/roles')
    router.refresh()
  }

  if (addable.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Add a Role</h1>
        <p className="text-gray-500">You already have all available roles.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Add a Role</h1>
      <div className="space-y-3">
        {addable.map(o => (
          <button key={o.role} onClick={() => setSelected(o.role)}
            className={'w-full rounded-xl p-4 text-left shadow-sm ring-1 transition ' + (selected === o.role ? 'ring-primary/40 bg-primary/[0.06]' : 'bg-white ring-gray-100 hover:ring-primary/30')}>
            <p className="font-semibold text-gray-900">{o.label}</p>
            <p className="text-sm text-gray-500">{o.description}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={handleAdd} disabled={!selected || saving}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
        {saving ? 'Adding…' : 'Add Role'}
      </button>
    </div>
  )
}
