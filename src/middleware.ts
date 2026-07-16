import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type Role, ROLE_ROUTES, SHARED_ROUTES } from '@/lib/permissions'

// Feature flags — read at edge runtime
const LANDLORD_TENANT_ENABLED = process.env.NEXT_PUBLIC_LANDLORD_TENANT_ENABLED === 'true'

/** Roles only accessible when LANDLORD_TENANT flag is on */
const LANDLORD_TENANT_ROLES: Role[] = ['landlord', 'tenant']

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/join-provider',
  '/forgot-password',
  '/verify-email',
  '/reset-password',
  '/auth',
  '/coming-soon',
  '/api/v1',
  '/api/webhooks/stripe',
  '/api/webhooks/twilio',
  '/api/health',
  '/api/search/sync',
]

/** Public routes that stay reachable even when already authenticated —
 *  the auth callback must run its code exchange, and a logged-in user
 *  clicking a recovery link still needs the reset form. */
const AUTHED_ACCESSIBLE_PUBLIC = ['/coming-soon', '/auth', '/reset-password']

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

function isLandlordTenantRoute(pathname: string) {
  return pathname.startsWith('/landlord') || pathname.startsWith('/tenant')
}

function getDefaultRoute(role: Role): string {
  // If landlord/tenant is disabled, fall back to customer dashboard
  if (!LANDLORD_TENANT_ENABLED && LANDLORD_TENANT_ROLES.includes(role)) return '/dashboard'
  switch (role) {
    case 'provider': return '/provider'
    case 'landlord': return '/landlord'
    case 'tenant': return '/tenant'
    case 'admin': return '/admin'
    default: return '/dashboard'
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static files, Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Safety net: Supabase auth links that land on the homepage with a ?code=
  // (the project Site URL default) get routed to the callback for exchange.
  if (pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = '/auth/callback'
    return NextResponse.redirect(callbackUrl)
  }

  // API routes handle their own auth — never block or redirect them
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Block landlord/tenant routes entirely when flag is off (before auth check)
  if (!LANDLORD_TENANT_ENABLED && isLandlordTenantRoute(pathname)) {
    return NextResponse.redirect(new URL('/coming-soon', request.url))
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unreachable — treat as unauthenticated so middleware doesn't crash
  }

  // Not authenticated
  if (!user) {
    if (isPublicRoute(pathname)) return response
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user hitting auth/public pages → redirect to their dashboard
  if (isPublicRoute(pathname) && !pathname.startsWith('/api')) {
    // Some public routes stay reachable when logged in (callback, reset form)
    if (AUTHED_ACCESSIBLE_PUBLIC.some((r) => pathname === r || pathname.startsWith(r + '/'))) {
      return response
    }
    const activeRole = (user.user_metadata?.active_role ?? 'customer') as Role
    return NextResponse.redirect(new URL(getDefaultRoute(activeRole), request.url))
  }

  // Shared routes are accessible to all authenticated users
  const isShared = SHARED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  )
  if (isShared) return response

  // Role-based access check
  const activeRole = (user.user_metadata?.active_role ?? 'customer') as Role
  const roleRoutes = ROLE_ROUTES[activeRole] ?? []
  const hasAccess =
    roleRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!hasAccess) {
    return NextResponse.redirect(new URL(getDefaultRoute(activeRole), request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
