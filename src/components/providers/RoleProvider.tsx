'use client'
import { createContext, useContext, type ReactNode } from 'react'
import { type Role } from '@/lib/permissions'
import { useAuthContext } from './AuthProvider'
import { supabase } from '@/lib/auth'

interface RoleContextValue {
  activeRole: Role
  availableRoles: Role[]
  switchRole: (role: Role) => Promise<void>
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, activeRole } = useAuthContext()

  const availableRoles = ((user?.user_metadata?.roles as Role[]) ?? ['customer'])

  async function switchRole(role: Role) {
    if (!availableRoles.includes(role)) {
      throw new Error(`You do not have the ${role} role`)
    }
    // Update user metadata via API route (which calls the Hono API)
    await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    // Refresh session so user_metadata reflects new active_role
    await supabase.auth.refreshSession()
  }

  return (
    <RoleContext.Provider value={{ activeRole, availableRoles, switchRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRoleContext() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRoleContext must be used inside RoleProvider')
  return ctx
}
