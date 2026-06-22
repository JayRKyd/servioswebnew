export type Role = 'customer' | 'provider' | 'landlord' | 'tenant' | 'admin'

export const ROLE_ROUTES: Record<Role, string[]> = {
  customer: ['/dashboard', '/book', '/search', '/services', '/bookings', '/reviews', '/providers'],
  provider: ['/provider', '/provider/bookings', '/provider/calendar', '/provider/availability', '/provider/earnings', '/provider/profile', '/provider/documents', '/provider/services', '/provider/analytics', '/provider/quotes', '/provider/payouts', '/provider/reviews'],
  landlord: ['/landlord', '/landlord/properties', '/landlord/tenants', '/landlord/maintenance', '/landlord/providers', '/landlord/bookings', '/landlord/compliance', '/landlord/analytics', '/landlord/quotes', '/landlord/emergency', '/landlord/settings'],
  tenant: ['/tenant', '/tenant/property', '/tenant/chat', '/tenant/maintenance', '/tenant/emergency'],
  admin: ['/admin', '/admin/users', '/admin/providers', '/admin/landlords', '/admin/bookings', '/admin/disputes', '/admin/compliance', '/admin/invitations', '/admin/analytics', '/admin/content', '/admin/claims', '/admin/settings'],
}

export const SHARED_ROUTES = ['/messages', '/notifications', '/settings', '/help']

export function hasPermission(role: Role, route: string): boolean {
  const allowed = [...ROLE_ROUTES[role], ...SHARED_ROUTES]
  return allowed.some((r) => route === r || route.startsWith(r + '/'))
}
