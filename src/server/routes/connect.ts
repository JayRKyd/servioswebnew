import { Hono } from 'hono'
import { supabase } from '../db/client'
import { stripe } from '../lib/stripe'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'
import { refreshProviderPayoutDelay } from '../lib/payments'

const connect = new Hono<{ Variables: { userId: string; user: any; activeRole: string } }>()

const STRIPE_V2_VERSION = '2026-09-30.endive'

/** UK Express-dashboard recipient account: Servios collects fees and carries
 *  losses (separate charges & transfers). Returns the acct_ id. */
async function createRecipientAccount(opts: { email?: string; displayName?: string; userId: string }): Promise<string> {
  const res = await fetch('https://api.stripe.com/v2/core/accounts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!.trim()}`,
      'Stripe-Version': STRIPE_V2_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(opts.email ? { contact_email: opts.email } : {}),
      ...(opts.displayName ? { display_name: opts.displayName } : {}),
      identity: { country: 'GB' },
      dashboard: 'express',
      defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      metadata: { userId: opts.userId },
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  if (!res.ok || !json?.id) {
    console.error('Stripe v2 account create failed:', json)
    throw new HTTPException(502, { message: 'We couldn’t start bank setup with Stripe — please try again in a minute.' })
  }
  return json.id as string
}

/** Recipient accounts never take charges — "ready" means transfers + payouts. */
function accountReady(account: { details_submitted?: boolean; payouts_enabled?: boolean; capabilities?: { transfers?: string } | null }) {
  return !!account.details_submitted && !!account.payouts_enabled && account.capabilities?.transfers === 'active'
}

connect.use('*', authMiddleware)

// Stripe Connect ships with the payments milestone — until the key exists,
// /status reports unavailable (the page shows a coming-soon state) and the
// action routes return a clear message instead of a raw 500.
const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY?.trim()

/**
 * POST /api/v1/connect/onboard
 * Creates (or retrieves) a Stripe Express account for the provider
 * and returns an Account Link URL for the onboarding flow.
 *
 * The frontend opens this URL in a browser/WebView.
 * Stripe redirects back to return_url on completion.
 */
connect.post('/onboard', async (c) => {
  if (!stripeConfigured()) {
    throw new HTTPException(503, { message: 'Online payouts are not live yet — bank account connection opens with the payments launch.' })
  }
  const userId = c.get('userId')

  // Look up existing Connect account
  const { data: profile } = await supabase
    .from('provider_profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', userId)
    .single()

  if (!profile) throw new HTTPException(404, { message: 'Provider profile not found' })

  let accountId = profile.stripe_account_id

  // Create the provider's Stripe account if none exists. Stripe refuses
  // Accounts v1 creation for new Connect integrations, so this goes through
  // Accounts v2; everything after (links, payout schedule) works on v1.
  if (!accountId) {
    const { data: user } = await supabase.from('users').select('email').eq('id', userId).single()
    const { data: names } = await supabase.from('provider_profiles').select('business_name, first_name, last_name').eq('user_id', userId).single()
    const displayName = names?.business_name?.trim() || `${names?.first_name ?? ''} ${names?.last_name ?? ''}`.trim() || undefined

    accountId = await createRecipientAccount({ email: user?.email ?? undefined, displayName, userId })

    const { data: pp } = await supabase
      .from('provider_profiles')
      .update({ stripe_account_id: accountId, stripe_account_status: 'pending' })
      .eq('user_id', userId)
      .select('id')
      .single()
    // New providers start on the longer clearing delay
    if (pp?.id) {
      try { await refreshProviderPayoutDelay(pp.id) } catch (e) { console.error('initial payout delay failed:', e) }
    }
  }

  // Always regenerate the onboarding link (links expire after a few minutes)
  const baseUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/provider/payouts?refresh=1`,
    return_url: `${baseUrl}/provider/payouts?success=1`,
    type: 'account_onboarding',
  })

  return c.json({ url: accountLink.url, accountId })
})

/**
 * GET /api/v1/connect/status
 * Returns the provider's Connect account status and capabilities.
 */
connect.get('/status', async (c) => {
  const userId = c.get('userId')

  const { data: profile } = await supabase
    .from('provider_profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', userId)
    .single()

  if (!profile) throw new HTTPException(404, { message: 'Provider profile not found' })

  if (!stripeConfigured()) {
    return c.json({ connected: false, status: 'not_connected', available: false })
  }

  if (!profile.stripe_account_id) {
    return c.json({ connected: false, status: 'not_connected', available: true })
  }

  // Fetch live status from Stripe
  const account = await stripe.accounts.retrieve(profile.stripe_account_id)

  const connected = accountReady(account)
  const restricted = !!account.requirements?.disabled_reason
  const status = connected ? 'active' : restricted ? 'restricted' : 'pending'

  // Sync status back to DB if it changed
  if (status !== profile.stripe_account_status) {
    await supabase
      .from('provider_profiles')
      .update({ stripe_account_status: status })
      .eq('user_id', userId)
  }

  return c.json({
    connected,
    status,
    accountId: profile.stripe_account_id,
    chargesEnabled: account.capabilities?.transfers === 'active',
    payoutsEnabled: account.payouts_enabled,
    payoutDelayDays: account.settings?.payouts?.schedule?.delay_days ?? null,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  })
})

/**
 * POST /api/v1/connect/dashboard
 * Returns a Stripe Express Dashboard login link so providers can
 * view their balance, payouts, and transaction history.
 */
connect.post('/dashboard', async (c) => {
  if (!stripeConfigured()) {
    throw new HTTPException(503, { message: 'Online payouts are not live yet.' })
  }
  const userId = c.get('userId')

  const { data: profile } = await supabase
    .from('provider_profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', userId)
    .single()

  if (!profile?.stripe_account_id)
    throw new HTTPException(400, { message: 'Stripe Connect account not set up' })

  if (profile.stripe_account_status !== 'active')
    throw new HTTPException(400, { message: 'Stripe Connect account not fully active' })

  const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id)

  return c.json({ url: loginLink.url })
})

export { connect as connectRoutes }
