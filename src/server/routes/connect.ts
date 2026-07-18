import { Hono } from 'hono'
import { supabase } from '../db/client'
import { stripe } from '../lib/stripe'
import { authMiddleware } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'

const connect = new Hono()

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

  // Create Express account if none exists
  if (!accountId) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    const account = await stripe.accounts.create({
      type: 'express',
      country: 'BS', // Bahamas
      email: user?.email,
      capabilities: {
        transfers: { requested: true },
      },
      metadata: { userId },
    })

    accountId = account.id

    await supabase
      .from('provider_profiles')
      .update({
        stripe_account_id: accountId,
        stripe_account_status: 'pending',
      })
      .eq('user_id', userId)
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

  const connected =
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled

  const status = connected ? 'active' : 'pending'

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
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
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
