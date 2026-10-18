import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth-server'
import { DisputeError } from './disputes'

type Handler<Ctx> = (args: { user: User; req: Request; ctx: Ctx }) => Promise<Response>

/** Route-handler wrapper for signed-in users (cookie session). Data access
 *  inside uses the service-role client, so handlers must check ownership. */
export function withUser<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
      return await handler({ user, req, ctx })
    } catch (err) {
      if (err instanceof DisputeError) return NextResponse.json({ error: err.message }, { status: err.status })
      console.error('route failed:', err)
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 })
    }
  }
}
