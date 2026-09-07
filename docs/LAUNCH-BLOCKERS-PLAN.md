# Launch blockers — root causes and fix plan

Client's Round 4 "launch blockers" list, investigated against the codebase on
2026-09-07. Item 4 (storage bucket) excluded per Jay. Sizes: S = under an hour,
M = half a day, L = a day-plus.

---

## Phase 1 — restore the core loop (all small, ship same day)

### 1. Provider can't open any booking — S (the client's #1)
**Root cause:** the detail query in
`src/app/(dashboard)/(provider)/provider/bookings/[id]/page.tsx:28` embeds three
columns on `customer_profiles` that only exist on `provider_profiles`
(`identity_verified`, `rating_average`, `total_jobs_completed`). PostgREST
rejects the whole query with a 400 → page renders "Booking not found."
**Fix:** drop the three columns from the embed; remove the null-guarded markup
that displayed them (lines ~200-213). The list page works because it never
embeds customer_profiles.
**Test:** provider opens a booking from Requests, accepts/rejects it.

### 2. Fixed prices showing ÷100 — S (one line)
**Root cause:** prices are stored in pounds everywhere; exactly one display
site divides by 100: `src/app/(dashboard)/(customer)/providers/[id]/page.tsx:549`.
**Fix:** remove the `/ 100`.
**Client-facing note:** the "£100.80 charge" was NOT a third wrong number — it
is the £90 service correctly charged £90 + 12% platform fee. Booking math is
sound; only the profile display was wrong.
**Test:** £120 service shows £120 on profile; booking totals unchanged.

### 8. Double booking + raw Postgres error — M
**Root causes:**
- No slot-conflict check anywhere (client insert at
  `bookings/new/page.tsx:153-167`, server route same).
- `UKDateInput` is a text input whose past-date guard silently returns without
  clearing form state; empty/malformed dates reach Postgres, and line 168
  renders the raw `error.message` in the UI.
**Fix:**
1. Pre-insert conflict query (`provider_id` + `scheduled_date` +
   `scheduled_time_start`, status in pending/accepted/in_progress) → friendly
   error.
2. DB-level partial unique index on those columns for the same statuses
   (client check alone is racy).
3. Validate `scheduled_date` in `handleSubmit` (format + not past) and fix
   `UKDateInput` to emit `''` on invalid instead of diverging.
4. Map DB errors to friendly copy — never render `error.message` raw.
**Test:** same-slot double booking blocked with clear message; past date shows
"Please enter a valid future date."

### 6c. Unverified providers bookable via direct URL — S
**Root cause:** search gates on `verification_status='verified'` (DB + Algolia)
but the public profile pages and `bookings/new` never read it.
**Fix:** load `verification_status` in `bookings/new` and block submit; hide
the "Request a booking" CTA on both profile variants when not verified.
**Test:** direct URL to unverified provider shows profile without a booking CTA;
`/bookings/new?provider=<unverified>` refuses.

### 6a. Onboarding "View My Dashboard" loops to step 1 — S
**Root cause:** `OnboardingProvider` fetches status once per mount (effect keyed
on user id only); completing onboarding nulls the module cache but never
updates mounted context, so the provider layout redirects using stale
`complete:false` until a full reload.
**Fix:** on documents submit, push `{complete:true}` into context optimistically
(and/or bump a version the provider re-fetches on). Cheapest reliable fallback:
full-page navigation from the completion button.
**Test:** finish onboarding → "View My Dashboard" lands on dashboard, no reload.

---

## Phase 2 — mobile + onboarding completeness

### 5. Mobile unusable — L (biggest single item)
**Root cause:** one shared dashboard shell (`src/app/(dashboard)/layout.tsx`)
renders `Sidebar` at fixed `w-[220px] shrink-0` with zero responsive handling;
`MobileNav.tsx` is an empty stub; `Header` has no menu button. Content gets
~155px on a phone.
**Fix (off-canvas drawer pattern):**
- `layout.tsx`: drawer open state + backdrop; sidebar hidden below `md`.
- `Sidebar.tsx`: `fixed inset-y-0 -translate-x-full md:static md:translate-x-0`,
  accepts open/onClose; closes on nav.
- `Header.tsx`: `md:hidden` hamburger.
- Update the skeleton state in layout.tsx (also hardcodes 220px).
- Sweep for fixed-width content overflow per screen afterward (tables/grids
  need `overflow-x-auto` wrappers, forms need to stack).
**Test:** every role's screens usable at 375px; no horizontal scroll.

### 6b. Onboarding never asks for availability — M
**Root cause:** setup is trade → services → documents; nothing writes
`provider_availability`, whose defaults are all-days-disabled →
"customers cannot book you."
**Fix:** add an Availability step between services and documents reusing the
logic from `provider/availability/page.tsx` (upsert keyed on
`provider_id = auth user id` — note NOT provider_profiles.id): per-day
enabled/start/end, sensible Mon–Fri 9-5 defaults, require ≥1 enabled day
before completing. Update `PROVIDER_SETUP_ROUTES` and every step's progress
header.
**Test:** new provider finishes onboarding with working days already set.

---

## Phase 3 — email + trust

### 7. No transactional email — L
**Current state:** `sendEmail` (Resend, branded domain) works — proven — but
nothing calls it. Bookings are inserted client-side, so there is no server
hook to attach email to.
**Fix (launch minimum = 3 emails):**
1. **Supabase Database Webhooks** (dashboard: Database → Webhooks) on
   `bookings` INSERT, `bookings` UPDATE (status), `messages` INSERT → POST to
   `/api/notifications/dispatch` with a shared secret header (same pattern as
   SYNC_SECRET). Webhooks fire regardless of where the insert happened —
   robust against the client-side-insert architecture.
2. That route looks up recipient emails (service role), renders branded HTML
   (reuse the email template layout), calls `sendEmail`:
   - booking INSERT → provider: "New booking request"
   - booking status UPDATE → the other party: accepted/rejected/started/
     completed/cancelled (reuse copy from `notifyBookingUpdate`)
   - message INSERT → recipient: "New message from X" (throttle: skip if an
     email for the same conversation went out in the last N minutes)
3. In-app gaps the client named: add message notifications for both roles and
   booking notifications for the customer (extend existing notifications
   table/push flow).
**Test:** book → provider email arrives; accept → customer email; message →
recipient email; no email storms on rapid messages.

### 9. Trust signals fakeable — M (launch minimum) + follow-up
**Root causes:**
- "Phone: Verified ✓" renders whenever `profile.phone` is non-empty
  (`providers/[id]/profile/page.tsx:352-356`, `provider/profile/page.tsx:778-783`).
  No `phone_verified` flag exists anywhere; Twilio webhook is a stub.
- Licences: free text rendered like credentials.
- Public full-profile sidebar exposes clickable `tel:` phone to any visitor
  (`providers/[id]/profile/page.tsx:323-330`) — off-platform invitation.
**Launch-minimum fix (honest UI, no new infra):**
1. Remove the "Verified" badge from phone display (show nothing or "Unverified").
2. Label the licences section "Self-declared" until routed through the
   `provider_documents` review pipeline (that pipeline already gates on
   verified/approved status — the right long-term home).
3. Remove the public `tel:` link entirely; contact via in-app messaging until a
   booking is accepted (Airbnb/Upwork model the client cited).
**Follow-up (post-launch):** real OTP via Twilio Verify → `phone_verified`
column → badge gated on it.
**Test:** typing a phone number shows no "Verified"; public profile has no
phone; licences read as self-declared.

---

## 3. Foreign-product content sweep — M

Confirmed: the app was built on a Bahamas marketplace base. Full inventory:

| What | Where | Action |
|---|---|---|
| Help FAQ: Bahamas coverage, landlord-tenant described as live, EST hours | `(shared)/help/page.tsx:9,10,38` | Rewrite FAQ for UK trades marketplace, GMT/BST hours, drop/flag-gate landlord copy |
| `island=` URL param + filter field through search/Get Quotes | `book/page.tsx:493`, `search/page.tsx`, `ProviderFilters`, `useProviderSearch` | Rename user-visible param/labels to `area`; internal/Algolia `islands` field renames staged later (needs reindex) |
| `BAHAMAS_ISLANDS` constant (values already London) | `src/lib/constants.ts:7` | Rename to `LONDON_AREAS` |
| Real Bahamas islands list + `en-BS`/USD helper (dead code) | `src/server/utils/helpers.ts` | Delete file |
| Tenant emergency page: 911/919, Royal Bahamas Police, 1-242 numbers | `tenant/emergency/page.tsx:4-7` | Replace with UK numbers (999/101/105/111) — landlord version already correct, copy it |
| `city:'Nassau', island:'New Providence'` form defaults | `landlord/properties/new/page.tsx:13` | UK defaults |
| Admin settings "Bahamas Islands" entry | `admin/settings/page.tsx:7` | Rename/remove |
| **Stripe Connect `country:'BS'`** | `src/server/routes/connect.ts:51` | **Change to `'GB'` — not on the client's list but worse than most of it: provider payout accounts are being created as Bahamian.** Existing test accounts need recreating. |
| `landlord_profiles`/`tenant_profiles` queried for every role | `src/hooks/useProfileIds.ts:49-54` (used by ~15 pages) | Skip those two queries when `NEXT_PUBLIC_LANDLORD_TENANT_ENABLED` is false |

Note: the landlord/tenant *feature* is correctly flag-gated and stays — only
stale copy and unconditional queries go.

---

## Suggested order

1. **Phase 1** (items 1, 2, 6a, 6c, 8) — one working session, restores the
   core loop the client called top of the list.
2. **Sweep (3)** — mostly mechanical, high embarrassment-value per hour.
3. **Phase 2** (5 mobile, 6b availability step).
4. **Phase 3** (7 email, 9 trust minimum).

Dashboard prerequisites (Jay): Supabase Database Webhooks for item 7 when we
get there; nothing else.
