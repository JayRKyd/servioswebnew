# Admin panel + real payments — plan

Client's admin-panel brief (2026-10-16) mapped against what exists in the
codebase. Sizes: S = under half a day, M = a day, L = two to three days.

**Progress:** Phase 0.1/0.2 shipped 2026-10-16 (`02c408f5`, migration
`20261016_admin_gate_audit_and_read_policies.sql`). Phase 1 shipped
2026-10-16 (`1aa79978`, migration `20261016_document_verification.sql`) —
required documents are ID + insurance; licence/certification are optional
badge credentials with the admin-confirmed number. Phase 0.3 shipped
2026-10-17 (`453aa641`, migration `20261016_payments_real_mode.sql`): real
sandbox payment verified end to end on production (authorise £45 with test
Visa → webhook → customer confirms → capture → Stripe shows succeeded).
Webhook endpoints live on the sandbox; `STRIPE_CONNECT_WEBHOOK_SECRET` is a
new env var. Next: Phase 2 (disputes & refunds) — the refund endpoint
already exists at `POST /api/admin/payments/[id]/refund`.
DDL must be pasted into the Supabase SQL editor by Jay (the MCP tool declines
statements containing `drop`); SQL files live in `supabase/migrations/`.

The headline: the admin panel is a skeleton, not a blank. 17 pages exist and
most read real data, but only four of them actually write anything
(commission rates, the verification page's per-document approve/reject, the
suspend-user toggle, two dispute status buttons). Everything else is either a
read-only table or a button that only changes React state. So this is a
finish-and-harden job, not a rebuild.

Two things must land before any of the client's features, because every
feature below adds admin power and two of them move money:

- **The admin gate is not safe enough to put refunds behind.** Middleware
  trusts `user_metadata.active_role`, a field Supabase lets users edit on
  their own account. Three different server checks disagree with each other
  (`users.roles` array, `users.active_role`, an `admin_profiles` table).
- **The Stripe code can never run in real mode as written**, even with keys
  set — three bugs guarantee the simulation path. Details in Phase 0.

---

## Phase 0 — foundations (do first, ~L)

### 0.1 Harden the admin gate — M
**Today:** `src/middleware.ts:135-142` reads `user.user_metadata.active_role`.
Users can normally write `user_metadata` via `supabase.auth.updateUser()`, so
the only thing stopping a customer from opening `/admin` is whatever RLS says
when they try to write — and RLS couldn't be verified this session (DB
timed out). Server routes check admin three incompatible ways
(`server/middleware/roles.ts:12`, `server/routes/settings.ts:38`,
`server/routes/claims.ts:84`).
**Fix:**
1. Admin membership lives in `app_metadata.roles` (only the service role can
   set it) **and** `public.users.roles`. One `isAdmin(user)` helper used by
   middleware, server routes and route handlers.
2. SQL function `public.is_admin()` reading the JWT's `app_metadata`, used by
   every admin RLS policy. Audit existing policies on `provider_profiles`,
   `provider_documents`, `users`, `disputes`, `reviews`, `bookings`,
   `payments`, `notifications` — admins get what they need, nobody else gets
   more than today.
3. Client names the admin accounts; we set `app_metadata` via the admin API.
**Test:** customer sets `active_role: 'admin'` on their own metadata → still
bounced from `/admin`, admin writes still RLS-denied.

### 0.2 Admin API layer + audit log — M
**Today:** every admin page writes straight from the browser with the anon
client, no error checks, no record of who did what. The only trace of any
admin action is `provider_documents.verified_by`.
**Fix:** `/api/admin/*` route handlers (service role, `isAdmin` guard) for
every write in this plan, each inserting an `admin_actions` row
(actor, action, target table/id, before → after, reason). Shared
`adminFetch()` on the client with inline error display (no `alert()`).
**Why now:** phases 1–7 all route through this; retrofitting later means
touching every page twice.

### 0.3 Wire Stripe for real — L
**Keys** (Jay has them): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_SECRET_KEY` in `.env.local` and Vercel. `STRIPE_WEBHOOK_SECRET` after
we register `https://<domain>/api/webhooks/stripe` in the Stripe dashboard
(the forwarding route already exists: `src/app/api/webhooks/stripe/route.ts`).

**Bugs that force simulation mode today** (`src/server/routes/payments.ts`):
- L45 looks up `provider_profiles.user_id = booking.provider_id`, but
  bookings store the **profile** id → `stripeReady` is always false.
- `bookings.payer_id` is never set by the web booking form
  (`bookings/new/page.tsx`) or offer-accept (`offers.ts:283`) → `/intent`
  403s for every real booking.
- L55 multiplies `platform_fee` by 100, but it's already stored in pence →
  application fee 100× too large.
- `confirmCardPayment(clientSecret)` is called with **no card element**
  (customer booking page L218) — there's no way for the customer to enter a
  card. Needs Stripe Elements (PaymentElement).

**Money model to implement** — the client chose "you collect payments and
pay recipients" in Connect, i.e. *separate charges and transfers*, not the
destination charges the code currently uses (`transfer_data.destination`).
That's the right choice for escrow and it maps cleanly onto the brief:
1. Customer books → PaymentIntent on the platform account, `capture_method:
   manual` (card authorised, not charged).
2. Customer confirms completion (`customer_confirmed_at`) → **capture** the
   full listed price.
3. Payout = a separate **`transfers.create`** of `total − platform_fee` to
   the provider's Connect account — triggered by admin "Release" (Phase 3)
   now, automatic later if the client wants.
4. Refund before transfer = `refunds.create`; after transfer = refund +
   `transfers.createReversal`.
Remove the milestone transfer path (`milestones.ts` — `currency: 'bsd'`,
would double-pay under destination charges, never called).

**Also:** `stripe_events` table for webhook idempotency (handler currently
replays blindly), `account.updated` must set `restricted` (UI shows it,
backend never writes it), `payment_status` type gains `authorized` and
`refunded`.

**Test:** Stripe test cards (4242…, 4000 0000 0000 3220 for 3DS, decline
card) through book → authorise → confirm → capture → transfer → refund, each
state visible in the Stripe dashboard and in `payments`. This is the "full
run of the real payment flow" the client wants — it hasn't happened yet
because it literally cannot today.

---

## Phase 1 — document verification (client's #1) — L

**What exists:** `admin/providers/verification/page.tsx` lists unverified
providers + pending docs, opens files via 600s signed URLs, approves/rejects
individual documents (writes `status`, `verified_at/by`, `rejection_reason`)
and approves/rejects providers. `src/hooks/useVerifiedCredentials.ts`
already turns verified docs into profile badges.

**Why it's still "by hand in the database":** approving documents never
flips the provider, and approving a provider doesn't require any approved
documents — the two flows are disconnected. Nothing writes
`identity_verified`. There's nowhere to store the actual credential number
(the only field is `licenses text[]`, free text typed by the provider).

**Build:**
1. **Queue** grouped by provider: each pending doc with type, title, expiry,
   upload date, and the provider's other docs' status in one row. Inline
   viewer (image/PDF) instead of a new tab.
2. **Credential capture:** add `credential_number`, `issuer`,
   `verified_number` to `provider_documents`. Provider enters the number when
   uploading (Gas Safe reg, NICEIC, insurer + policy no.); admin confirms or
   corrects it on approval. Profile badge then shows "Gas Safe registered ·
   123456" from the *verified* value, not the typed one.
3. **Rejection with reason** (required field, inline confirm) → shows on the
   provider's documents page + "action needed" email.
4. **Auto-flip** as a DB function: when all required types (`id`,
   `insurance`, `license` — client to confirm per-trade requirements) are
   verified → `verification_status='verified'`, `is_verified`,
   `identity_verified` (from the ID doc), `verified_at`, in-app notification +
   "You're verified" email, Algolia reindex. Manual "Verify anyway" stays for
   edge cases, logged with reason.
5. **Expiry:** nightly job flags docs expiring within 30 days (email
   provider), marks `expired` on the day and drops the badge. Whether expiry
   un-verifies the provider is a client decision (recommend: no, but hide
   from search until renewed).
6. Emails via the dispatch route: document approved/rejected, account
   verified/rejected (triggers on `provider_documents` update and
   `provider_profiles.verification_status` change).

**Test:** upload 3 docs as a provider → admin approves 2, rejects 1 with
reason → provider sees reason + email → re-uploads → approve → provider flips
to verified automatically, appears in search, badges show credential number.

---

## Phase 2 — disputes & refunds (client's #2) — L+

**What exists:** `disputes` table (reason, description, status,
resolution — no visible booking/party link), admin list + detail that only
toggle status, a `claims` table *and* a `workmanship_claims` table that
disagree on columns, a refund endpoint (`payments.ts:285`) with **no
ownership or admin check** that nothing calls. Nothing lets a customer raise
a dispute at the confirm step.

**Build:**
1. **Customer "Report a problem"** at the confirm step: reason (not done /
   poor quality / damage / didn't show / overcharged), description, photos.
   Creates a dispute linked to booking + both parties, **holds release**
   (`customer_confirmed_at` stays null, provider sees "under review"
   banner, payout screens show "held"). Provider can respond with text +
   photos.
2. **One table.** Fold `claims` and `workmanship_claims` into `disputes`
   with a `kind` column; the hidden guarantee-claims UI points at it when the
   client's policy exists.
3. **Admin dispute detail:** booking summary + payment state, both parties'
   cards, timeline, evidence gallery, the booking's chat thread (read-only),
   and an admin message box that posts to either or both parties (delivered
   as in-app + email).
4. **Resolution actions** (all through the admin API, all audited, all
   emailing both sides): full refund to customer, partial refund (amount
   field), release to provider, split. Each maps to the Stripe calls in
   0.3 (cancel authorisation / refund / capture + transfer / reversal).
5. **Lock down** the refund endpoint (admin only, handles `sim_` payments,
   updates `bookings.payment_status='refunded'`), and make customer
   cancellation of an authorised booking cancel the PaymentIntent
   automatically (today cancelling never touches the payment).

**Client decisions needed:** who absorbs the Stripe processing fee on a
refund; whether partial refunds are allowed; dispute window after completion.

**Test:** book + authorise → "Report a problem" → provider replies → admin
partial refund → customer card shows refund in Stripe, provider gets
remainder, both get emails, dispute closed with resolution text.

---

## Phase 3 — payout oversight — M

**What exists:** no payouts table; provider earnings page computes
`base − fee` from completed bookings and never looks at whether money
moved. Connect onboarding works (GB, Express accounts).

**Build:** `payouts` table + `/admin/payouts`: every captured booking with
state **owed** (captured, not released) / **released** (date, method,
reference or transfer id) / **held** (open dispute) / **paid out** (Stripe
payout status from the connected account). "Release" button: records a
manual payout (method, reference, date) while the team pays by hand; the
same button does `transfers.create` once Connect is live, with the mode
switch being whether the provider has an active Connect account. Provider
earnings page reads from `payouts`/`payments` so "paid" means paid.

**Client decision:** stay admin-released, or auto-release N hours after the
customer confirms with no dispute. Recommend auto-release after 48h once
Connect is live, admin-only until then.

---

## Phase 4 — review moderation — M

**What exists:** no moderation columns; rating recalculation happens only in
an unused server route (client-side inserts rely on a DB trigger we
couldn't verify this session).

**Build:** `reviews.hidden_at / hidden_by / hidden_reason / flagged_at /
flag_reason`. `/admin/reviews`: search by provider/reviewer, filter
flagged/hidden, hide with reason (reversible), delete (audited). Provider
"Report this review" button → flagged queue. DB trigger recalculates
`rating_average`/`total_reviews` on insert, update and delete **excluding
hidden** — verify or create it. Public pages and the review email skip
hidden reviews.

---

## Phase 5 — booking oversight — M

**What exists:** `/admin/bookings` is a 50-row `select('*')` table with no
links, no party names, no pagination.

**Build:** columns for reference, customer, provider, service, date, amount,
booking status, payment status; filters + search by booking reference;
`/admin/bookings/[id]` with full timeline, payment + payout state, photos,
chat (read-only), dispute link. Actions: cancel (with automatic
cancel-authorisation or refund), force status to unstick (e.g. mark
completed, reopen, revert to accepted) with required reason, resend the
last notification. All audited, all emailing the affected parties.

---

## Phase 6 — user management — M

**What exists:** 50-row list, email-only search that refetches per
keystroke, role filter applied in the browser; detail page's activity list
is empty because it filters bookings by auth id while bookings store
profile ids; "Suspend" sets `users.is_active=false` and **nothing else** —
the person can still sign in.

**Build:** server-side search (email, name, phone, booking reference) with
pagination; detail page showing all profiles, bookings (via the correct
profile ids), reviews, disputes, payments, last sign-in; actions: suspend
(also `auth.admin.updateUserById({ ban_duration })` + sign out sessions,
middleware shows a "suspended" page), reinstate, close account (anonymise
PII, ban, keep booking/payment records for accounting), add/remove role
(server routes already exist, unused), send password reset, admin notes.

---

## Phase 7 — seed content purge — S/M

**Known markers** (nothing is in the repo — it's all live data): "John
Smith" with the pizza portfolio, Pete's reviews authored by "Customer"
(reviews whose `reviewer_id` has no `customer_profiles` row), the default bio
"A trusted and established member of the Servios community.", the lowercase
duplicate `carpentry` category, old Bahamian Connect test accounts, the
`claude-wizard-test@servios.co.uk` account.
**Keep:** `faizaansaeeed+prov1` (client's tester) and the client's own test
accounts — listed explicitly in the tool.

**Build:** `/admin/settings/launch-cleanup`: detects each category above
(orphan reviews, providers with no auth user or a known test email, default
bios, duplicate categories, photos matching the seed hashes), shows a
dry-run preview with checkboxes, deletes via the admin API, then triggers an
Algolia reindex. One-shot, audited.

---

## Phase 8 — tidy the rest — S

- `admin/content` moderation only changes React state and its `auth.users`
  embed almost certainly fails → wire approve/reject to a real
  `booking_photos.marketing_status` or remove it from nav.
- `admin/settings`: "Service Categories" / "Service Areas" link to `#` →
  build a small categories editor (needed for the duplicate-category fix) or
  remove.
- Delete the five empty stubs in `src/components/admin/`.
- Analytics + home page download whole tables to count in the browser →
  SQL aggregate RPCs; home's "Platform Revenue" should be commission, not
  booking value.
- One shared `StatusBadge` instead of three copies.
- Turn on build-time TypeScript checking (`next build` currently skips it;
  it has shipped two runtime crashes).

---

## Sequence and size

| Order | Phase | Size | Blocked on |
|---|---|---|---|
| 1 | 0.1 Admin gate + 0.2 Admin API/audit | L | client names admin emails; DB reachable |
| 2 | 0.3 Stripe real mode | L | keys in Vercel; webhook secret after registration |
| 3 | 1 Document verification | L | required-doc rules per trade (client) |
| 4 | 2 Disputes & refunds | L+ | refund policy decisions (client) |
| 5 | 3 Payout oversight | M | release rule (client) |
| 6 | 5 Booking oversight | M | — |
| 7 | 4 Review moderation | M | — |
| 8 | 6 User management | M | — |
| 9 | 7 Seed purge | S/M | client confirms keep-list |
| 10 | 8 Tidy | S | — |

Roughly three working weeks end to end. Phases 0–2 are the client's stated
top two plus their prerequisites and are the first milestone; a payment
run with real test cards is the sign-off for that milestone.

## What we need from the client

1. Email addresses of the admin users.
2. Stripe sandbox keys into Vercel (or to Jay), Connect left on "collect
   payments and pay recipients" as chosen.
3. Required document types per trade (is Gas Safe mandatory for gas work,
   NICEIC/Part P for electrical, etc.) and what happens at expiry.
4. Refund rules: Stripe fee absorbed by whom, partial refunds yes/no,
   dispute window after completion.
5. Payout release rule: admin-released for now (as stated), and whether to
   auto-release after N hours once Connect is live.
6. Confirm the keep-list for the seed purge.

## Open verification (DB was unreachable this session)
Before 0.1 ships: dump current RLS policies for the admin tables, confirm
whether a rating-recalculation trigger exists on `reviews`, confirm the
`admin_profiles` table and who's in `users.roles` as admin today.
