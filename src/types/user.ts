import type { Role } from './roles'

export interface User {
  id: string
  email: string
  phone: string
  roles: Role[]
  active_role: Role
  primary_role: Role
  created_at: string
}
