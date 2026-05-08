import type { Role } from "@/lib/permissions"

interface RoleSwitcherProps {
  currentRole: Role
  availableRoles: Role[]
  onSwitch: (role: Role) => void
}

const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  provider: "Provider",
  landlord: "Landlord",
  tenant: "Tenant",
  admin: "Admin",
}

export function RoleSwitcher({ currentRole, availableRoles, onSwitch }: RoleSwitcherProps) {
  return (
    <div>
      <select
        value={currentRole}
        onChange={(e) => onSwitch(e.target.value as Role)}
        aria-label="Switch role"
      >
        {availableRoles.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </div>
  )
}
