import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const LANDLORD_TENANT_ENABLED = process.env.NEXT_PUBLIC_LANDLORD_TENANT_ENABLED === 'true'

/** Where each role lands after confirming their email. Providers land on
 *  /provider, whose onboarding gate walks them into setup if incomplete. */
function roleDestination(role: string | undefined): string {
  switch (role) {
    case 'provider': return '/provider'
    case 'landlord': return LANDLORD_TENANT_ENABLED ? '/landlord' : '/dashboard'
    case 'tenant':   return LANDLORD_TENANT_ENABLED ? '/tenant' : '/dashboard'
    case 'admin':    return '/admin'
    default:         return '/dashboard'
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Supabase reports expired/invalid links via error params instead of a code
  if (searchParams.get('error') || !code) {
    return NextResponse.redirect(`${origin}/login?auth_error=link_invalid`)
  }

  const cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...(cookies as typeof cookiesToSet))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    // The verify endpoint already confirmed the email before redirecting here;
    // the exchange itself can fail (e.g. link opened in a different browser).
    // The account is usable — send them to log in with a clear message.
    return NextResponse.redirect(`${origin}/login?auth_notice=confirmed_please_login`)
  }

  const meta = data.user.user_metadata ?? {}
  const role = (meta.active_role ?? meta.role) as string | undefined

  // Password-recovery links carry ?next=/reset-password
  const destination = next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : `${roleDestination(role)}?verified=1`

  const response = NextResponse.redirect(`${origin}${destination}`)
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
  return response
}
