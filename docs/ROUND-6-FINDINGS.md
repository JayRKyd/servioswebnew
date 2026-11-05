# Round 6 — triage of the client's disputes & refunds verification

Source: `round6-report.md` (client, 3 Nov 2026). Checked against the code and
live data on 3 Nov. Sizes: S = under half a day, M = a day, L = two to three.

Verdict in one line: the payment and refund rails are sound (the client proved
authorise → capture → refund in Stripe twice, and the dispute flow worked both
sides), but the **booking lifecycle has no payment gate**, so a job can be
started, completed and "paid" with no money ever taken. That single gap
produces blockers 1, 2 and half of 3. Everything else is wording, visibility
and a design pass.

Confirmed in data: BK-20261103-E34113 is `completed`, customer-confirmed,
`payment_status = unpaid`, **no payments row**, and its open dispute
DSP-20261103-10E15D holds £0. The payments table is right for the refunded
jobs (£52.80 / £22.00 owed); the earnings page just never reads it.

---

## A. Blockers — fix first (~1 day together)

### A1. Unpaid jobs can be completed and "paid" (client #1) — M
**Root cause (four gaps, same theme — nothing checks that a payment exists):**
- Provider "Mark In Progress" / "Mark Completed" (`provider/bookings/[id]`)
  only check the calendar, never `bookings.payment_status`.
- Customer "Pay" button renders only while status is `accepted`/`in_progress`;
  once the provider completes, it vanishes (`bookings/[id]`).
- "Confirm Job Complete" sets `customer_confirmed_at` unconditionally; the
  capture route returns `null` when there is no payment and the page shows
  "Payment released" because it keys on `customer_confirmed_at`.
- The dispatch "payment released" emails fire on `customer_confirmed_at` with
  no payment check, so the provider gets "You've been paid £79.20" for £0.
**Fix:**
1. Provider: In Progress / Complete require `payment_status in (authorized,
   paid)` when `total_amount > 0`; inline notice "The customer hasn't
   authorised payment yet" with a one-click "Ask them to pay" (sends the
   customer a nudge email with an Authorise button).
2. Customer: Pay step available in every pre-confirmation state
   (accepted / in_progress / completed-unconfirmed).
3. Confirm requires an authorised payment (or a £0 booking); otherwise the
   page shows the Pay step first. Server: capture route refuses when no
   authorised payment exists.
4. **Database guard** so no screen can bypass it: `customer_confirmed_at` can
   only be set when `payment_status in (authorized, paid)` or `total_amount
   = 0` (service role exempt for admin resolutions).
5. Dispatch: "You've been paid" / receipt only when a `succeeded` payment
   exists; otherwise a "Job confirmed — payment still needed" email instead.
6. Data: BK-20261103-E34113 corrected (confirmation cleared, status back to
   provider-completed) so the open case can be resolved cleanly from admin.

### A2. Customer can confirm from Accepted, before the date (client #2) — S
**Root cause:** `canConfirm` allows `accepted` and `in_progress` (a Round 4
decision — "customer can confirm while work is underway"). The client now
wants confirmation gated on the provider's completion.
**Fix:** customer can confirm only when `status = completed` and not yet
confirmed. The customer update writes `customer_confirmed_at` only (status
is already `completed`). DB guard: `customer_confirmed_at` requires
`old.status = 'completed'`. Removes the date question entirely — the
provider's own date guard already prevents early completion.

### A3. Provider earnings ledger is wrong (client #3) — M
**Root cause:** `provider/earnings` totals `bookings` with `status =
completed` (provider-completed, not customer-confirmed, not paid) and
computes `base − fee` itself — so it counts unpaid jobs, future-dated jobs
and never sees refunds or holds. The `payments` rows are correct.
**Fix:** rebuild the ledger from `payments` (`succeeded` /
`partially_refunded` → `provider_payout_amount`, minus open-dispute holds)
with four buckets: **Available**, **Clearing** (captured, bank date =
captured + payout delay), **On hold** (disputes), **Paid out** (manual
payout recorded, or Stripe transfer). Transaction rows show gross, refund,
commission, net, and "clears to bank on …" / "paid by Servios team". Jobs
without a payment appear as "Awaiting customer payment", not earnings. This
is the provider-facing half of Phase 3; the admin payouts screen follows.

### A4. Statement descriptor is "Stripe" (client #4) — S
**Root cause:** the sandbox account's `settings.payments.statement_descriptor`
is empty, so Stripe's default applies; the PaymentIntent sets none.
**Fix:** set the account descriptor to `SERVIOS` (API, sandbox now; the client
repeats it in the live dashboard or we set it with the live key), and put
`statement_descriptor_suffix = <booking ref tail>` on every intent so
statements read `SERVIOS* BK-4F3C34`. Also fill `business_profile.url` and
`support_email` while there.

---

## B. Should fix before launch (~1.5 days)

### B5. "Message provider" links land on the booking page (client #5) — S
**Root cause:** `conversationPathFor()` only returns the chat when a
conversation row already exists; at "accepted" nobody has messaged yet, so
it falls back to the booking page. Not a regression — the fallback was always
there.
**Fix:** a `/messages/for-booking/[id]` route that finds-or-creates the
booking's conversation (either party) and redirects into it. Every email uses
it, so the link is the chat whether or not anyone has written yet.

### B6. "You've been paid" email (client #6) — S
Only sent when a payment is captured (A1). Adds customer name, job amount,
commission line, net, and the bank line: "clears to your bank on {date}"
when Connected, otherwise "paid out by the Servios team". Subject carries
the customer and reference (`You've been paid — £79.20 · Priya S ·
BK-…1DEE50`) so Gmail stops threading every payout together.

### B7. Dispute window / held amount visibility (client #7) — S
Customer: "You can report a problem until {date}" on every completed
booking (and on the case card). Provider: "£26.40 of your payout is on hold
for this case" on the case card and in the problem-reported email. Both
emails state the held sum.

### B8. Dispute entry point gating (client #8) — S
**Root cause (two things):** eligibility treats a completed job as reportable,
but the panel only fetches eligibility on mount — after the client confirmed
on the same page nothing refetched, so no card appeared. Separately, past the
30 days the panel renders nothing.
**Fix:** refetch when booking status changes; show "The window to report a
problem on this job closed on {date} — contact support" after the window;
completed jobs always reportable regardless of date.

### B9. "Report a problem" on unpaid bookings promises a hold (client #9) — S
Keep the report (a no-show on an unpaid job is still a valid complaint) but
the copy and the hold logic read the payment: with no payment, "we'll look
into it" and no hold; the admin case shows "No payment taken".

### B10. "Payment released" above "payment on hold" (client #10) — S
While a case is open, the payment panel on both sides becomes "Payment on
hold — £X under review" and the Leave-a-review button is hidden.

### B11. Provider can't tell the customer has paid (client #11) — S
Provider booking page reads `payment_status`: "Awaiting customer payment"
→ "Customer's payment authorised ✓ £90 secured" → "Paid". Plus an in-app
notification + short email to the provider when the card is authorised.

### B12. Stripe Customer per Servios user (client #12) — M
Create a Stripe Customer the first time a user pays, store
`stripe_customer_id` on `customer_profiles` (migration), attach it and
`receipt_email` to every intent, prefill the Link email from the account.
Stripe-side records then match Servios accounts.

### B13. Booking-accepted email says "you're all set" (client #13) — S
Add the next step: "Before the visit, authorise £90 on your card — nothing is
charged until you confirm the job" with an "Authorise £90" button.

---

## C. Polish (S each, batch with B)
- Payment Element font: pass a web-safe system stack via the Appearance API
  (the iframe can't inherit the page font). Client #14.
- Hide "Leave a Review" while a dispute is open (B10). Client #15.
- Provider In-Progress guard is date-only by design (client agrees). #16.
- Carried from Round 5: VAT line on receipts (**needs the client's VAT number
  — or confirmation Servios isn't VAT-registered, in which case no line**),
  star glyphs → text, logo `alt`, manage-notifications link, service address
  echoed on the customer's booking page. #17.

---

## D. Design pass — emails + app (L, after A–C)

**Emails** (client Part 5b): one base template, per-type accent strip and
icon (green money-in, amber action-needed, red problem); greeting
("Hi Priya,") and sign-off; initials fallback whenever the avatar is a
placeholder; a real receipt (line items, card brand + last 4 from the
charge, paid-on date, VAT line if applicable, printable); "what happens
next" line per email; label whose words a quote is; footer address not
auto-linked blue; body 15px / table 14px; subjects carry reference +
counterparty to defeat Gmail threading; manage-notifications link.

**App** (client Part 5b): status stepper at the top of both booking pages
(Pending → Accepted → Paid → In progress → Done → Confirmed); one primary
button per screen; provider profile hero fallback (gradient + initials or
trade icon) instead of the grey silhouette; dashboards put upcoming jobs and
pending requests above the stat cards; earnings split (A3 delivers the
data); dispute card 3-step progress (Reported → Replied → Decision) with the
£ at stake; address as a map link.

---

## E. Not bugs — answers for the client
- **"None of his 9 emails are in our inboxes."** Correct and by design: the
  first run used Jay's test accounts (so the client's inboxes weren't
  flooded); the second run the same evening (DSP-20261018-3FE34D) went to
  Priya and Daniel — the 11 emails the client did receive.
- **"Webhook processing plausible, not proven."** Proven on our side: every
  Stripe event is recorded in `stripe_events` with `processed_at` and no
  error — the two refund events for 3FE34D and the capture events for
  1DEE50 are all there. We can show the table.
- **"Payouts and the 7/14-day hold are not wired to Stripe."** Correct today:
  the transfer / reversal code is live but only runs for a provider with an
  active Connect account, and **no provider has completed Connect
  onboarding**. It's a form a person has to fill in (Stripe's test mode
  accepts test details). Until then the ledger is internal, and A3 makes
  that visible instead of pretending money moved. Suggest Daniel completes
  "Connect Bank Account" so the next round can see a real transfer and a
  real hold.
- **"No admin account exists."** `testadmin@servios.com` exists but isn't a
  real inbox. The client should name the email address(es) to make admin;
  granting is one audited API call (no database work). Admin alert emails
  will then stop bouncing too.
- **"Grey silhouette avatar in the customer's emails."** Daniel's profile
  photo *is* a silhouette image — it was uploaded to his account during
  testing (`avatars/d4c7e98f…/1788320255155.png`). The emails show whatever
  the provider uploaded, as they should; upload a real photo and it's fixed.
  The initials fallback already applies when no photo is set.
- **Stripe dashboard default account** (`acct_1UQv1YV05v8bqM1d`) has no
  payments because the app uses `acct_1UQv1jV05dqN9YGs` — worth switching
  the dashboard's default.

---

## Order
A1 → A2 → A4 → A3 (ledger), then B5–B13 + C, then D. A-block and B-block each
ship with a live retest on the client's accounts; the open case
DSP-20261103-10E15D is resolved from admin as the admin-side proof once the
client has an admin login.

**Needs from the client:** admin email address(es); VAT number or "not
registered"; Daniel to complete Connect onboarding in test mode (optional but
unlocks the transfer/hold test).

---

Round 3 review cross-check (`docs/SERVIOS ROUND 3 REVIEW.md`): items 1–31 all
shipped in earlier rounds; #32 (display type + warm accent) is the only one
open and is now part of section D above.
