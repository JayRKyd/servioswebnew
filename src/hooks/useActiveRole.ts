'use client'
import { useRoleContext } from '@/components/providers/RoleProvider'

export function useActiveRole() {
  const { activeRole, availableRoles } = useRoleContext()
  return { activeRole, availableRoles }
}
