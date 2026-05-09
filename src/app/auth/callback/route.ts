import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const role = (data.user.user_metadata?.active_role ?? 'customer') as string
      const roleRoutes: Record<string, string> = {
        provider: '/provider',
        landlord: '/landlord',
        tenant: '/tenant',
        admin: '/admin',
        customer: '/dashboard',
      }
      const destination = roleRoutes[role] ?? '/dashboard'
      return NextResponse.redirect(new URL(destination, origin))
    }
  }

  // Something went wrong — send to login with an error hint
  return NextResponse.redirect(new URL(`/login?error=auth_callback_failed&next=${next}`, origin))
}
