export type Role = 'customer' | 'provider' | 'landlord' | 'tenant' | 'admin'

export const ROLE_ROUTES: Record<Role, string[]> = {
  customer: ['/dashboard', '/book', '/search', '/saved', '/services', '/bookings', '/reviews'],
  provider: ['/provider', '/provider/bookings', '/provider/calendar', '/provider/availability', '/provider/earnings', '/provider/profile', '/provider/documents', '/provider/services', '/provider/analytics', '/provider/quotes', '/provider/payouts', '/provider/reviews'],
  landlord: ['/landlord', '/landlord/properties', '/landlord/tenants', '/landlord/maintenance', '/landlord/providers', '/landlord/bookings', '/landlord/compliance', '/landlord/analytics', '/landlord/quotes', '/landlord/emergency', '/landlord/settings'],
  tenant: ['/tenant', '/tenant/property', '/tenant/chat', '/tenant/maintenance', '/tenant/emergency'],
  admin: ['/admin', '/admin/users', '/admin/providers', '/admin/landlords', '/admin/bookings', '/admin/disputes', '/admin/compliance', '/admin/invitations', '/admin/analytics', '/admin/content', '/admin/claims', '/admin/settings'],
}

export const SHARED_ROUTES = ['/messages', '/notifications', '/settings', '/help', '/providers']

/** Landing route for a role — landlord/tenant fall back to the customer
 *  dashboard while the feature flag is off. */
export function getDefaultRoute(role: Role): string {
  const landlordTenantEnabled = process.env.NEXT_PUBLIC_LANDLORD_TENANT_ENABLED === 'true'
  if (!landlordTenantEnabled && (role === 'landlord' || role === 'tenant')) return '/dashboard'
  switch (role) {
    case 'provider': return '/provider'
    case 'landlord': return '/landlord'
    case 'tenant': return '/tenant'
    case 'admin': return '/admin'
    default: return '/dashboard'
  }
}

export function hasPermission(role: Role, route: string): boolean {
  const allowed = [...ROLE_ROUTES[role], ...SHARED_ROUTES]
  return allowed.some((r) => route === r || route.startsWith(r + '/'))
}
