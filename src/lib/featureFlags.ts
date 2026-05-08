/**
 * Feature flags — controlled via environment variables.
 *
 * NEXT_PUBLIC_ prefix makes them readable in both server and client code.
 * Toggle at deploy time (Vercel env vars) or in .env.local during development.
 *
 * Phase 1 launch: NEXT_PUBLIC_LANDLORD_TENANT_ENABLED=false
 * Phase 2 launch: NEXT_PUBLIC_LANDLORD_TENANT_ENABLED=true
 */
export const FLAGS = {
  /** Phase 2 — landlord + tenant dashboard, properties, tenants, maintenance */
  LANDLORD_TENANT: process.env.NEXT_PUBLIC_LANDLORD_TENANT_ENABLED === 'true',
} as const
