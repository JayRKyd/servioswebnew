export const ROLES = ['customer', 'provider', 'landlord', 'tenant', 'admin'] as const

export const BOOKING_STATUSES = ['pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'] as const

export const MAINTENANCE_PRIORITIES = ['low', 'medium', 'high', 'emergency'] as const

export const BAHAMAS_ISLANDS = [
  'Central London', 'North London', 'South London', 'East London', 'West London',
  'Greater London',
] as const

export const DEFAULT_COMMISSION_RATES = {
  standard: 12,
  preferred: 10,
  emergency: 15,
} as const
