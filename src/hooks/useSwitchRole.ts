'use client'
import { useState } from 'react'
import { useRoleContext } from '@/components/providers/RoleProvider'
import { type Role } from '@/lib/permissions'

export function useSwitchRole() {
  const { switchRole } = useRoleContext()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSwitch(role: Role) {
    setIsPending(true)
    setError(null)
    try {
      await switchRole(role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch role')
    } finally {
      setIsPending(false)
    }
  }

  return { switchRole: handleSwitch, isPending, error }
}
