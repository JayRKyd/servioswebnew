import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  // Supabase reports expired/invalid links via error params instead of a code
  if (searchParams.get('error') || !code) {
    return NextResponse.redirect(`${origin}/login?auth_error=link_invalid`)
  }

  // ── Password recovery: the reset form needs a session, so exchange the code ──
  if (next === '/reset-password') {
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
      // No session possible (e.g. link opened in a different browser) — the
      // reset page shows its "link expired — request a new one" state
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    const response = NextResponse.redirect(`${origin}/reset-password`)
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  // ── Email confirmation: Supabase already verified the address before
  // redirecting here. Deliberately no auto-login — land on the login page
  // with a clear "your email is confirmed" notice and let them sign in.
  return NextResponse.redirect(`${origin}/login?auth_notice=confirmed_please_login`)
}
