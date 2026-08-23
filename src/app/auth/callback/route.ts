import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { type Role, getDefaultRoute } from '@/lib/permissions'

function safePath(path: string | null): string | null {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safePath(searchParams.get('next'))

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

  function redirectWithSession(to: string) {
    const response = NextResponse.redirect(`${origin}${to}`)
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  // ── Password recovery: the reset form needs the session from the code ──
  if (next === '/reset-password') {
    if (error || !data?.user) {
      // No session possible (e.g. link opened in a different browser) — the
      // reset page shows its "link expired — request a new one" state
      return NextResponse.redirect(`${origin}/reset-password`)
    }
    return redirectWithSession('/reset-password')
  }

  // ── Email confirmation ──
  if (error || !data?.user) {
    // Exchange failed (link opened in a different browser/device, so the PKCE
    // verifier cookie is missing). The address itself is already confirmed by
    // Supabase before it redirects here — so ask them to log in normally.
    return NextResponse.redirect(`${origin}/login?auth_notice=confirmed_please_login`)
  }

  // Session created — land role-aware: provider → provider onboarding,
  // customer → dashboard, etc. A deep link (next) wins over the role default.
  const role = (data.user.user_metadata?.active_role ?? data.user.user_metadata?.role ?? 'customer') as Role
  const destination = next && next !== '/dashboard' ? next : getDefaultRoute(role)
  return redirectWithSession(`/auth/confirmed?next=${encodeURIComponent(destination)}`)
}
