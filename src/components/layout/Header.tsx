'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Bell } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useActiveRole } from '@/hooks/useActiveRole'
import { useRoleContext } from '@/components/providers/RoleProvider'
import type { Role } from '@/lib/permissions'

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Customer',
  provider: 'Provider',
  landlord: 'Landlord',
  tenant:   'Tenant',
  admin:    'Admin',
}

export function Header() {
  const router = useRouter()
  const { activeRole, availableRoles } = useActiveRole()
  const { switchRole } = useRoleContext()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSwitch(role: Role) {
    if (role === activeRole) { setOpen(false); return }
    setSwitching(true)
    try {
      await switchRole(role)
      setOpen(false)
      const dest: Record<Role, string> = {
        customer: '/dashboard', provider: '/provider',
        landlord: '/landlord',  tenant: '/tenant', admin: '/admin',
      }
      router.push(dest[role])
      router.refresh()
    } catch (e) {
      console.error('Role switch failed', e)
    } finally {
      setSwitching(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-[64px] items-center justify-between border-b border-border bg-white px-6 shrink-0">
      {/* Left — breadcrumb placeholder */}
      <div />

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link href="/notifications" className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:bg-gray-50 hover:text-dark transition-all">
          <Bell size={17} />
        </Link>

        {/* Role switcher */}
        {availableRoles.length > 1 ? (
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen(v => !v)}
              disabled={switching}
              className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] font-medium text-dark hover:bg-gray-50 disabled:opacity-60 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <span>{ROLE_LABELS[activeRole]}</span>
              <ChevronDown size={14} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-border bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] py-1.5">
                <p className="px-3 pb-1.5 pt-0.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Switch Role</p>
                {availableRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => handleSwitch(role)}
                    className={'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition hover:bg-gray-50 ' +
                      (role === activeRole ? 'font-semibold text-primary' : 'text-dark')}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${role === activeRole ? 'bg-primary' : 'bg-gray-300'}`} />
                    {ROLE_LABELS[role]}
                    {role === activeRole && <span className="ml-auto text-[11px] text-primary font-medium">Active</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[12px] font-semibold text-primary capitalize">
            {activeRole}
          </span>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-muted hover:bg-gray-50 hover:text-dark transition-all"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  )
}
