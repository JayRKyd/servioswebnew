# Round 6 — Disputes & refunds verification

**Date:** 3 November 2026
**Build:** https://servioswebnew.vercel.app (Stripe sandbox `acct_1UQv1jV05dqN9YGs`)
**Scope:** Verify every claim in Jordy's 18 Oct messages (withdrawal-hold plan + "disputes and refunds work end to end") and run the dispute flow ourselves.

**Accounts:** Priya Sharma (customer, `fizzie5114+cust2`), Daniel Okafor (provider, `faizaansaeeed+prov1`). **No admin account exists** — admin-side claims remain unverified until Jordy provides one.

**Method note:** Priya driven directly in Chrome. Daniel's actions done by Faizaan in an Incognito window on my instruction (extension can't see Incognito tabs). Stripe dashboard checked directly.

---

## Part 1 — Stripe dashboard (checked before our run)

### Jordy's own test case (DSP-20261018-165039)
- Payment `pi_1URMQPV05dqN9YGsza0gNUzd`, **£45.00**, booking BK-20261017-DEABC6.
- Authorised 17 Oct 01:28, captured 01:29 (manual-capture flow: `payment_intents` → `confirm` → `capture`).
- **£20.00 refunded 18 Oct 20:53** — `POST /v1/refunds 200 OK`. ✅ Claim "Stripe refunded £20 to the card" is TRUE.
- Metadata `platform_fee: 540` (£5.40 = 12% of £45) ✅ matches "down from £5.40".
- 17 Oct + 30 days = 16 Nov ✅ matches "window runs to 16 Nov".
- Used a **different customer and provider** (`payer_user_id b477a42f…`, `provider_profile_id 2f13037d…`) — not Priya/Daniel. **This is why none of his "9 emails" are in our inboxes**; they went to his own test accounts. Not a bug.

### The 18 Oct demo case (DSP-20261018-3FE34D)
- Payment `pi_1US18sV05dqN9YGsPlq3TED2`, **£90.00**, booking BK-20261018-4F3C34 (Priya → Daniel).
- Authorised 20:57:19, captured 20:57:24, **£30.00 refunded 20:58:55**. ✅
- Metadata `platform_fee: 1080` (£10.80) ✅.
- Stripe kept its **£3.04 processing fee** on the refund (net £56.96) — confirms Servios absorbs the fee, as agreed.
- `charge.refunded` event emitted with `amount: 9000, amount_refunded: 3000` ✅.

### Webhooks
- Two **active** endpoints at `https://servioswebnew.vercel.app/api/webhooks/stripe`: platform account (13 events, "payments, refunds, transfers", API 2026-09-30) and connected accounts (4 events). ✅ Endpoint exists.
- Delivery success for the 18 Oct refund events not independently confirmed (dashboard delivery view only shows this week). Claim "refund notifications were received and processed" = plausible, not proven.

### Connect / payouts — IMPORTANT
- **Connected accounts: only Stripe's two sample "Test account"s** (15 Oct, both Restricted). **No connected account for Daniel or any real provider.**
- **Transfers: only Stripe's £100 sample** (15 Oct). **No transfers for either booking.**
- ⇒ "Provider is paid as soon as the customer confirms, money goes into their Stripe balance straight away" is **not live in Stripe**. Provider earnings/holds are currently an internal ledger. Refunds are real; payouts and the 7/14-day hold are not yet wired to Stripe. Jordy framed the hold as a proposal ("this is how I'd do it"), so not a false claim — but the report must distinguish ledger from Stripe.

### Other
- Sandbox `acct_1UQv1YV05v8bqM1d` (the one the Stripe dashboard opens by default) has **zero payments** — the app uses `acct_1UQv1jV05dqN9YGs`. Worth noting for anyone looking in the dashboard later.

---

## Part 2 — Customer side of the resolved demo case (3FE34D), viewed as Priya

Booking page `/bookings/9da23a3b-…`:
- Status Completed, banner **"Partially refunded — £30.00 has been returned to your card — allow 5–10 working days"** ✅ ("booking shows partially refunded").
- Problem-report card: case ID, "Poor quality work", **Resolved** badge, decision text, then timeline: her report (21:58, "asked for Partial refund (£30.00)") → Daniel's reply → "Servios support is reviewing this case" marker → support's message. ✅
- **No internal note visible** to the customer ✅ (consistent with claim; can't prove a note existed on this case).
- "Report another problem with this job" link present — second-dispute path exists (to test).
- Minor: "Leave a Review" button sits directly above the dispute card on a disputed job.

---

## Part 3 — Our live run (BK-20261103-1DEE50)

- Booked as Priya: Boiler Service, 4 Nov 10:00, 14 Camden Road NW1 9DP, £90. Created fine; status Pending.
- Booking page says: *"£90.00 will be authorised on your card once the provider accepts — nothing is charged until you confirm the job is done."* — i.e. authorise-on-accept, capture-on-confirm. Matches Stripe's manual-capture pattern seen above.
- Address still not echoed on the customer's own booking page (open item from R5).

### Step 1 — Daniel accepts (done 3 Nov ~05:05)
- Provider booking page before accept: customer name, **address shown** (14 Camden Road, NW1 9DP), duration 60 min, breakdown £90 / −£10.80 (12%) / **£79.20**, "Payment in escrow — released once customer confirms". Accept / Reject / Message. ✅
- After accept: status Accepted, button becomes "Mark In Progress". ✅
- Emails: Daniel got "New booking request — Boiler Service, £90.00" (04:51); Priya got "Booking accepted — Boiler Service" (05:06). ✅
- "Booking accepted" email read in full: identity block (★ 5.0, 2 reviews), service/when/duration/location/price/reference, View booking + Message provider + View profile + Cancel booking, legal footer. Good.
  - ❌ **"Message provider" href = the booking page** (`/bookings/5697a164…`), not the chat. Jordy's 22 Sept message said "Message links go to the actual chat" — still not true on this build.
  - ⚠️ Says "You're all set — we'll let you know when work starts" but the customer's next action is to **authorise the card** (booking page: "Payment opens once accepted"). The email doesn't mention it, so a customer who only reads email won't know payment is pending.

### Provider Payouts page (`/provider/payouts`)
- "Stripe Connect — **Not connected**" + "Connect Bank Account" button (not clicked — it would create a Connect account / start ID verification).
- "How payouts work" copy now states the agreed plan verbatim: card authorised on accept → charged on confirm → "land in your Stripe balance immediately" → "clears to your bank 7 days later (14 for your first few jobs)… after that it arrives daily". So the hold policy is in the UI copy. **Enforcement can't be tested** without a connected account (none exist — see Part 1).

### Provider Earnings page (`/provider/earnings`, All time) — ❌ BUG
- Transaction history lists the **18 Oct job (BK-20261018-4F3C34) as £90.00 gross / −£10.80 / £79.20 net**. That job had a **£30 partial refund** — Daniel should keep **£52.80** (and the email he received says exactly that). The ledger has not applied the refund.
- Period total £396.00 / commission £54.00 are therefore overstated (should be £369.60 / £50.40 if the refund were applied).
- No "date it will reach your bank" column or any hold/available indicator — Jordy's proposal said the earnings page would show this; it doesn't yet.
- Contradicts "the money side already works the way you described" at least as far as what the provider sees.

### Step 2 — Priya's payment step (customer booking page after accept)
- Status Accepted, card **"Awaiting payment — £90.00 is authorised on your card before work begins and only charged when you confirm the job is complete."** Button **"Pay £90.00 securely"**. ✅ Matches the authorise/capture design.
- Clicking it reveals an inline Stripe Payment Element (card number / expiry / CVC / country, optional Link "save my info" box, "Authorise £90.00" / "Not now", "Payments are processed by Stripe. Servios never sees your card number."). ✅
- ⚠️ **"Confirm Job Complete" button is visible while status is Accepted, before payment and before work starts.** Needs testing on a throwaway booking: if it works, a customer can mark a job complete that never happened / was never paid. (Not clicked on this booking.)
- Polish: the Payment Element renders in a default serif font — not themed to match the site.
- First attempt used a non-test card by mistake → Stripe declined ("Your request was in test mode, but used a non test card"). ✅ **Decline handling works**: message shown inline under the card field and in a red box above the button; form stays open for retry; booking status unchanged. Nothing charged (test mode).
- Card then entered by Faizaan with Stripe test card 4242 → **authorised**. Booking page now: status Accepted, card **"Payment held in escrow — £90.00 is secured. Confirm the job is complete to release it to your provider."**, buttons Confirm Job Complete / Cancel Booking / Message. ✅ Payment form collapsed; no "Pay" button remains.
- **Stripe:** £90.00 **Uncaptured**, "Servios booking BK-20261103-1DEE50", 3 Nov 05:20. ✅ Authorise-only confirmed (not captured).
- ⚠️ Stripe "Customer" on the payment = `faizaansaeeed@gmail.com` — the email typed into Stripe Link's optional "save my information" box, not Priya's Servios account email. The app isn't attaching a Stripe Customer built from the Servios user; it relies on whatever Link collects. Means Stripe-side customer records won't match Servios accounts.
- Payment `pi_1UXa2wV05dqN9YGsrupN68qd`: metadata `booking_id`, `booking_number`, `payer_user_id 34ad824a…` (Priya), `provider_profile_id 57d623cf…` (Daniel), `platform_fee 1080` — all correct ✅. The declined attempt is logged (402 at 05:16), successful confirm at 05:20.
- ❌ **Statement descriptor = "Stripe"**. The customer's bank statement will read "Stripe", not "Servios". `statement_descriptor` / account-level descriptor needs setting before launch — unrecognised descriptors are a top cause of chargebacks.
- No email to either side on authorisation (Priya got nothing new; Daniel still only has the original request email). Arguably fine, but the provider has no signal that payment is now secured.

### Step 3 — Daniel's view after authorisation
- ⚠️ Provider booking page is **unchanged after the customer authorises**: still "Payment in escrow — Released to you once the customer confirms job completion." Nothing tells the provider the card is now secured vs. still awaiting payment. A provider can't tell whether to turn up. Needs a visible "Customer's payment authorised ✓" state (and ideally an email/notification).
- Page also shows an "ACTIVE OFFER — No conversation started yet — Start Conversation" block. ✅ chat entry point exists on provider side.

### Step 4 — Mark In Progress (blocked by date guard)
- Clicking "Mark In Progress" on 3 Nov for a 4 Nov booking → inline message **"This job is scheduled for 4 Nov 2026 — you can mark it in progress on the day."** Status unchanged. ✅ Provider-side date guard works, and at 05:30 UK on 3 Nov it correctly treats today as 3 Nov (the old UTC bug would have said 2 Nov — not a full test of the 00:00–01:00 BST window, but consistent).
- Consequence for this run: can't progress BK-…1DEE50 until 4 Nov. Pivoting to test the customer-side "Confirm Job Complete" guard on this booking instead.

### Step 5 — ❌ BUG: customer can confirm completion before the job date / before provider completes
- As Priya, on BK-…1DEE50 (status **Accepted**, scheduled **4 Nov**, provider never marked In Progress or Complete), clicked "Confirm Job Complete" on 3 Nov.
- Dialog: "Confirm the job is complete? This releases £90.00 to your provider. Only confirm when you're happy with the work." → **"Yes — release payment"** → **accepted**.
- Result: status **Completed**, banner "**Payment released — £90.00 released to your provider** (Servios keeps a 12% service fee from the provider's side — you pay no fees)", review modal opened immediately.
- No date guard (the provider side has one), and **no state-machine guard**: Accepted → Completed skipped In Progress and the provider's own completion step entirely.
- Impact: lifecycle integrity (no provider completion, no completion photos, dispute clock starts before any work), provider-side screens may now be stuck. Fraud risk is low (customer pays early), but it also means the "customer confirms completion" step isn't actually gated on the provider saying the job's done. Should require status = provider-completed (and arguably date ≥ scheduled date).

### Step 6 — Capture + payout email (after the premature confirm)
- **Stripe:** `POST /v1/payment_intents/…/capture 200 OK` at **05:25:18**, status **Succeeded**, £90.00 captured, Stripe fee £3.04, net £86.96, "Funds available Nov 10". ✅ **Capture-on-confirm proven end to end.**
- Stripe Customer on the payment is a **Guest** (`gcus_…`) with email `faizaansaeeed@gmail.com` (from Link) — reinforces the earlier note: no Servios-linked Stripe Customer.
- Daniel's **"You've been paid — £79.20"** email (05:25) read in full: identical template to Round 5 — "The customer confirmed the job is complete and your payout has been released", Service / When / Job amount £90 / Your payout £79.20 / Reference, View earnings + View booking, footer.
  - ❌ Still says "released" with no mention of the 7-day (14-day) bank hold now described on the Payouts page — contradicts the agreed policy and the R5 note Jordy said he'd take on.
  - Still no commission line (£10.80), no customer name, no bank-arrival date. All R5 polish items on this template remain open.
- No email to Priya was checked yet at this point (see below).

### Step 7 — ❌ Customer has no way to raise a dispute on a fresh completed booking
- Priya's completed booking page (`/bookings/5697a164…`) shows: status Completed, "Payment released" card, notes, **"Leave a Review"** — and nothing else. DOM search for problem/issue/report/dispute/refund finds only the sidebar "Help" link.
- The resolved demo booking showed a dispute card and "Report another problem with this job" link — but only because a case already existed.
- `#problem` anchor: nothing rendered (no element with that id). Bookings list: no report links. Help page: no report/dispute/refund entries. Receipt email: links are Leave a review / View booking / dashboard / Help Centre only — no report link.
- **Resolved:** the **29 Sept booking (Accepted, unpaid, date passed)** DOES show the card: *"Something not right? Tell us what happened and we'll hold the payment while Servios support looks into it. — Report a problem."* ⇒ the entry point is **gated on scheduled date ≤ today**, not on status.
  - Consequence with the Step 5 bug: a booking can be Completed + captured with **no way to dispute it until its scheduled date arrives**.
  - ⚠️ It also shows on an **unpaid** Accepted booking, promising to "hold the payment" when there is none. (Not exercised — would create an un-closeable case with no admin login.)
  - ⚠️ The 22 Sept completed booking (42 days old, outside the 30-day window) shows **nothing** — no "dispute window closed on …" message. Customers past the window get no explanation.
- Priya's **"Payment receipt"** email (05:25) read in full: identity block, Service / When / Amount paid £90 / Reference, Leave a review + View booking, footer. Still no VAT line (R5 item). "Leave a review" links to the booking page (fine — modal is there).

### Step 8 — Second booking dated today, to reach a real dispute
- Booked as Priya at ~05:35: Boiler Service, **3 Nov 09:00**, same address, £90 → **BK-20261103-E34113** (`/bookings/4d32ee7d-…`), Pending. Form accepted a same-day future slot ("within the provider's working hours"). ✅
- No "Report a problem" card on a Pending same-day booking ⇒ the gate is status-based as well as date-based (Accepted + date ≤ today showed it on the 29 Sept booking).

### Step 9 — ❌ Provider can start AND complete a job with no payment authorised
- As Daniel on BK-…E34113 (customer had **not** paid): Accept ✅ → **Mark In Progress** accepted (at ~05:40 for a 09:00 slot — the guard is date-only, not time) → **Mark Completed** → "No after photos uploaded yet… You can still complete without them" → **Complete without photos** → status **Completed**, "Awaiting customer confirmation — your payout of £79.20 is released once the customer confirms."
- Throughout, the provider page showed "**Payment in escrow**" even though **no PaymentIntent had been confirmed** for this booking. The provider has no signal the job is unpaid.
- ❌ **Earnings ledger counts it immediately**: `/provider/earnings` "This month" = **£158.40, 2 jobs done, £21.60 commission** — the 3 Nov job (no payment exists) and the 4 Nov job (dated tomorrow). Earnings are recognised on provider-complete, not on customer-confirm/capture. Combined with the 18 Oct refund not being applied, the earnings page is not a reliable statement of what the provider is owed.
- Emails: Daniel received "New booking request" for #2 (05:29). No email on accept/in-progress/complete to him (expected). Priya's side checked next.
- Expected: block (or at least warn on) In Progress/Complete until payment is authorised; recognise earnings only on capture.

### Step 10 — ❌ Payment step disappears once the provider has completed
- As Priya on BK-…E34113 (provider-completed, **never paid**): page shows status Completed, banner "**Provider marked this job complete — Happy with the work? Confirm below to release payment. Not right? Message the provider or raise an issue.**", buttons **Confirm Job Complete** / Leave a Review, and the "Something not right? … Report a problem" card.
- **No "Pay £90.00 securely" button exists any more.** The payment step is only offered in the Accepted state; once the provider moves the job on, the customer can no longer authorise. Combined with Step 9, the normal path "provider turns up and does the job before the customer has got round to paying" ends with a job that can never be paid through the app.
- The "Report a problem" card IS shown here (status Completed, date = today) — confirms the gate is status ≥ Accepted AND date ≤ today.

### Step 11 — ❌❌ Customer "releases" a payment that was never taken
- Clicked Confirm Job Complete → dialog "This releases £90.00 to your provider… Not happy? Report a problem instead — the payment stays held." → **Yes — release payment** → **accepted**.
- Page now: "**Payment released — £90.00 released to your provider**", review modal. **No PaymentIntent exists for this booking** — Stripe payments list searched for "E34113": nothing; the full list is 1DEE50, 4F3C34, DEABC6 and the two Stripe samples only. The app has marked £90 as paid and £79.20 as owed to the provider with £0 collected.
- Root cause chain: (Step 9) provider can complete unpaid → (Step 10) customer's Pay button disappears → (Step 11) confirm releases a non-existent payment. **This is the most serious finding of the round** — it's not an edge case, it's the ordinary "tradesperson does the job before the customer pays" path.
- Daniel received a second **"You've been paid — £79.20"** email at 05:37 for this unpaid job.
- Fix direction: gate provider In Progress/Complete on an authorised PaymentIntent (or keep the Pay step available in every pre-confirm state and make Confirm require a captured/capturable payment).

### Step 12 — Raising the dispute as Priya (BK-…E34113)
- "Report a problem" opens an inline form: intro "The provider is asked for their side, the payment is held, and Servios support decides. Nothing is released while it's open." ✅
- **WHAT WENT WRONG?** radios: Work not finished / Poor quality work / Damage to property / Provider didn't turn up / Charged more than agreed / Problem appeared after the job / Something else — each with a one-line explainer. Good taxonomy.
- **DESCRIBE WHAT HAPPENED** textarea (placeholder nudges dates/specifics). **WHAT WOULD YOU LIKE TO HAPPEN?** Full refund / Partial refund / Provider to put it right / Something else. Partial refund reveals a "£ ___ of £90.00" amount field. **PHOTOS (strongly recommended)** file picker. Send report / Cancel.
- ✅ **Validation:** £150 → "Enter an amount up to £90.00", form stays open.
- Sent: Poor quality work, partial refund **£30.00**, description. → Case **DSP-20261103-10E15D** created at 05:39.
- Case card on the booking page: "PROBLEM REPORT · DSP-20261103-10E15D — Poor quality work — **Reported — waiting for review**", banner "The payment for this job is on hold. Servios support will review both sides and decide — usually within 2 working days.", timeline entry "You reported · 3 Nov, 05:39 · asked for Partial refund (£30.00)" + text, "ADD TO THIS CASE" textarea with Attach/Send, "Both sides and Servios support can see messages here." ✅
- ⚠️ Customer sees **no dispute-window end date** and **no held amount** — Jordy's "window runs to 16 Nov" and "£17.60 put on hold" exist only server-side/admin. The customer should see "You can raise issues until <date>" somewhere and the provider should see what's held.
- ⚠️ The green "**Payment released**" banner still sits directly above a case saying "**payment is on hold**" — contradictory on one screen.
- ⚠️ On this booking the "hold" is on £0 — no payment exists (Step 11). The dispute system doesn't notice.

### Step 13 — Case thread + emails on report
- Customer "ADD TO THIS CASE" message posted → appears in timeline as "You · 3 Nov, 05:40 · Follow-up: …" ✅.
- **Daniel's email** "Action needed: a problem was reported — Boiler Service" (05:39) read in full: "A customer reported a problem — Please give your side as soon as you can — Servios support reads both before deciding anything. **The amount in question is held until the case is resolved; the rest of your earnings aren't affected.**", Priya identity block, Case / Job / Booking / Issue card, her report text quoted, **"Respond to the customer"** → `/provider/bookings/4d32ee7d…#problem`, footer. ✅ Same template as the 18 Oct demo. Still **no held amount stated** (R6 polish item from the demo emails stands).
- Daniel also received **"Priya Sharma replied — case DSP-20261103-10E15D"** (05:40) for the follow-up message ✅.
- Priya's **"We've received your report"** email (05:39) read in full: "We've got your report — We've asked Daniel Okafor for their side, and the payment for this job is on hold until it's sorted. Servios support will review both and be in touch — you can add photos or more detail any time.", Case/Job/Booking/Issue card, **"View your case"** → `/bookings/4d32ee7d…#problem`, footer ✅. (No window end-date here either.)
- Priya's inbox since the second booking: "Booking accepted" (05:34), **"Work started — Boiler Service"** (05:34, new template: "Work has started — Your provider is on the job"), **"Job marked complete — Boiler Service"** (05:34, "Confirm Boiler Service to release £90.00"), "Payment receipt" (05:37), "We've received your report — DSP-20261103-10E15D" (05:39). All five delivered. ✅
  - **"Work started"** read in full: "Work has started — Your provider is on the job.", identity block, Service/When/Duration/Location/Price/Reference, View booking + Message provider + View profile. ✅
  - **"Job marked complete"** read in full: "Provider marked your job complete — Happy with the work? Confirm to release the £90.00, then leave a review.", same card, **"Confirm & release £90.00"** button (R5 fix confirmed ✅), Message provider + View profile.
  - ❌ **"Message provider" → booking page** in both (not the chat). Same regression as the accepted email.
  - ⚠️ "Confirm to release the £90.00" was sent for a booking with **no payment** (Step 9–11) — the email pipeline doesn't check either.

### Step 14 — Daniel's view of the case
- Provider booking page (`/provider/bookings/4d32ee7d…#problem`): payout card now reads "**Payment released — £79.20 has been released to you. If you've connected your bank on the Payouts page it clears to your account after the clearing period; otherwise the Servios team pays it out.**" ✅ Better wording than the email — acknowledges the Not-connected state and the clearing period.
- Case card: "PROBLEM REPORT · DSP-20261103-10E15D — Poor quality work — Reported — waiting for review", banner "**The amount in question is on hold** until this is resolved. Please give your side below — support reads both before deciding.", Priya's report (with "asked for Partial refund (£30.00)") and her follow-up both visible, "**YOUR SIDE OF WHAT HAPPENED**" textarea + Attach + Send, "Both sides and Servios support can see messages here." ✅ Matches Jordy's row 2 ("their reply shows on the case").
- ⚠️ "The amount in question" is never stated. By Jordy's 88% rule, £26.40 of the £30 should be on hold; the provider can't see that figure anywhere.
- ⚠️ Same contradiction as the customer side: "Payment released £79.20" card directly above "amount on hold".
- Job Photos (before/after) still uploadable after completion — useful for dispute evidence ✅.
- **Daniel's reply posted** (05:44) → appears in the timeline as "You · 3 Nov, 05:44 · …", banner changes to "The amount in question is on hold until this is resolved. **Thanks for responding — support will be in touch.**", textarea relabels to "ADD TO THIS CASE". ✅ Row 2 of Jordy's table verified from the provider side.
- ❌ **Earnings page after the dispute: unchanged** — still £158.40 / 2 jobs / £79.20 for the disputed job. Jordy's "£26.40 (88% of £30) put on hold straight away" is **not reflected anywhere the provider can see**. If the hold exists it's admin/ledger-only.
- **In-app notifications** (`/notifications`, provider): "Update on case DSP-…10E15D — Priya Sharma: Follow-up…", "A customer reported a problem — … Please respond.", "Job confirmed complete — Customer confirmed booking #BK-…E34113 is complete. Payment will be released.", "New booking request", and the same for 1DEE50. ✅ Notifications fire for every step.

### Step 15 — Priya's side of the reply
- Priya's inbox: **"Daniel Okafor replied — case DSP-20261103-10E15D"** (05:44) delivered and read in full: "New reply from Daniel Okafor", Case/Job/Booking/Issue card, his text, **"Reply on Servios"** → `/bookings/4d32ee7d…#problem`, footer ✅. Customer-side rendering of a provider reply in the case timeline was verified on the 18 Oct demo booking (Part 2); not re-checked here to save a session swap.

---

## Part 4 — Jordy's "disputes and refunds work end to end" table, row by row

| # | Jordy's step | Verdict | Evidence |
|---|---|---|---|
| 1 | Customer reports a problem, asks for £20 back → allowed, 30-day window to 16 Nov, £17.60 (88%) held | **Partly verified** | Report form, partial-refund amount, validation and case creation all work (Step 12). His dates/maths check out (17 Oct + 30 = 16 Nov; 88% of £20 = £17.60). **But** neither the window end-date nor the held amount is shown to customer or provider anywhere, and the provider's earnings page doesn't reflect any hold (Step 14). Hold is unobservable outside admin. |
| 2 | Provider replies → shows on the case | **Verified** | Step 14: reply appears in timeline both sides; emails + in-app notifications fire. |
| 3 | Admin opens queue/case, sees report, reply, money breakdown incl. hold | **Not verified — no admin login** | |
| 4 | Admin messages both sides + internal note; customer sees message, not note | **Not verified — no admin login** | Customer side of the 18 Oct demo shows support messages and no internal note, consistent but not proof. |
| 5 | Admin previews £20 partial refund: customer pays £25, provider £22.00, Servios £3.00 | **Maths verified, screen not** | Stripe metadata confirms 12% fee amounts; the arithmetic is right. Preview screen is admin-only. |
| 6 | Admin resolves → Stripe refunds £20, booking "partially refunded", hold cleared, refund webhooks processed | **Stripe side verified; webhook processing plausible** | Part 1: real £20 refund on `pi_1URMQP…` at 18 Oct 20:53 (and £30 on the demo). Customer booking shows "Partially refunded" (Part 2). Webhook endpoints exist and are active; delivery success not independently confirmed. **Provider earnings never applied the refund** (Part 3, earnings bug). |
| 7 | All 9 emails delivered | **Verified for our run, unverifiable for his** | His 9 went to his own test accounts (different payer/provider IDs). Our run: customer got 6 (accepted, work started, job marked complete, receipt, report received, provider replied), provider got 5 (request, paid ×2 incl. the bogus one, problem reported, customer replied). All read in full. |

**Withdrawal-hold plan (7 days / 14 for first 5 jobs):** the policy text is on the Payouts page ✅, but **no Connect accounts, no transfers, no bank-arrival dates, no visible holds** exist yet. It's documented, not implemented. Fine as a proposal — but the "You've been paid" email and the "Payment released" cards talk as if money has moved.

---

## Part 5 — Findings, ranked

### Blockers (must fix before any real money)
1. **Unpaid jobs can be completed and "paid".** Provider can Mark In Progress/Complete with no authorised payment (Step 9); the customer's Pay button then disappears (Step 10); Confirm releases a payment that was never taken (Step 11); provider gets a "You've been paid £79.20" email and £79.20 in earnings for a £0 booking. Stripe has no PaymentIntent for BK-…E34113. **This is the ordinary "tradesperson arrives before the customer has paid" path, not an edge case.**
2. **Customer can confirm completion on any Accepted job** — no date guard and no requirement that the provider has completed (Step 5). Completed a job dated tomorrow from Accepted.
3. **Provider earnings ledger is wrong**: counts provider-completed-but-unconfirmed jobs, counts unpaid jobs, counts a job dated tomorrow, and never applied the 18 Oct £30 refund (still shows £79.20 instead of £52.80). Holds aren't reflected either. The page can't be trusted for what a provider is owed.
4. **Statement descriptor is "Stripe"** — customers' bank statements won't say Servios. Chargeback magnet.

### Should fix before launch
5. **"Message provider" links in customer emails go to the booking page, not the chat** — regression vs Jordy's 22 Sept "fixed" claim (accepted, work-started, job-complete emails all affected).
6. **"You've been paid" email** still says "released" with no commission line, no customer name, no bank-arrival date, and now contradicts the 7/14-day hold. The provider booking page wording ("clears after the clearing period; otherwise the Servios team pays it out") is right — copy it into the email.
7. **No dispute-window end date shown** to customers; **no held amount shown** to providers; dispute emails don't state the held sum or the breakdown (carried from the demo-email review).
8. **Dispute entry point hidden by date gate** — a completed job dated in the future can't be disputed; and outside the 30 days the card silently disappears with no "window closed on …" message.
9. **"Report a problem" shows on unpaid Accepted bookings** promising to "hold the payment".
10. **"Payment released" banner sits directly above "payment is on hold"** on both sides during a dispute.
11. **Provider page gives no signal that the customer has paid** — "Payment in escrow" text is identical before and after authorisation.
12. **Stripe Customer isn't created from the Servios user** — the payment's customer is a Guest with whatever email Link collected (`faizaansaeeed@gmail.com` on Priya's booking).
13. **Booking-accepted email** says "You're all set" without telling the customer to authorise their card.

### Polish
14. Payment Element renders in a default serif font — not themed.
15. "Leave a Review" button sits above an open dispute.
16. Provider In-Progress date guard is date-only (05:40 for a 09:00 slot passed) — fine, but inconsistent with the "on the day" wording if a time check was intended.
17. Everything carried from R5 (VAT line, star glyphs, logo alt, manage-notifications link, address echo on customer page) still open.

### What's genuinely good
- Authorise-on-accept / capture-on-confirm works end to end in Stripe, with correct metadata and 12% fee. Declines are handled cleanly.
- Partial refunds really happen in Stripe (two proven), with commission scaling on what the provider keeps.
- The dispute form, case timeline, two-way messaging, emails and in-app notifications are well built and consistent on both sides.
- Webhook endpoints are live. Date guard on provider side works and uses UK time.

## Part 5b — Design & UX review (emails rendered in Gmail; app screens as used above)

### Emails — not broken, but generic and thin
Rendered they're clean: white card, logo, bold heading, grey intro, details table, one green button, legal footer. Nothing is misaligned. The problem is they all look identical and say the minimum.
1. **Every email is the same template** — "paid", "problem reported", "refund approved" and "work started" are visually indistinguishable. Needs a per-type accent (green for money in / success, amber for action needed, red for problems) and an icon or status strip so the eye knows what kind of email it is before reading.
2. **Placeholder avatars** — the identity block shows a grey silhouette because Daniel has no photo. On a real provider it'll be fine; on any provider without a photo it looks unfinished. Fall back to initials (the app already does this) instead of the silhouette.
3. **No greeting, no sign-off** — "Hi Priya," and "— The Servios team" make it feel like a person sent it. Competitors all do this.
4. **The receipt isn't a receipt.** Primary button is "Leave a review"; no line items, no "paid with Visa •••• 4242", no paid-on date, no VAT line, no print/PDF link. A customer keeping it for records gets a marketing-style card.
5. **No "what happens next".** The accepted email should say "you'll be asked to authorise £90 before the visit"; the problem-received email should give the 2-working-day SLA and the window end-date; the refund email should show £90 paid → £30 refunded → £60 kept.
6. **Decision/quote text is in italic with a left border** — ambiguous whose words they are (support's? the provider's?). Label the speaker.
7. **Gmail auto-links the registered-office address** (blue underline in the footer) — set an explicit colour/`text-decoration:none` on it.
8. **Small, low-contrast type** — 13px grey on light grey for most content; bump body to 15px and the details table to 14px.
9. No manage-notifications link, no app/social footer, logo `alt=""` (carried).

**Provider inbox (faizaansaeeed+prov1), rendered in Gmail — all 5 of today's emails opened and viewed:**
- Same template family; the provider ones are slightly better because the **customer identity block uses initials** ("P" in a green circle) rather than a silhouette. So the initials fallback already exists — the customer-side emails show a grey silhouette only because Daniel's profile has a placeholder image set. Either way: never send a placeholder image, always fall back to initials.
- **"New booking request"**: the best of the set — initials, Service/When/Duration/Location/Job amount/Reference, the customer's note quoted, "Accept or decline" + "Message customer". Missing: a respond-by nudge ("customers usually book whoever replies first"), the customer's rating/history, and "Message customer" still → booking page.
- **"You've been paid"**: four rows and a button. No customer name, no commission line, no bank-arrival date (R5 items, still open) — and today two identical ones arrived, one for a job with no payment.
- **"A customer reported a problem"**: clear and well-structured (ask → who → case card → their words → one button). Still doesn't state the held amount.
- **"Priya Sharma replied"**: fine, minimal.
- ⚠️ **Gmail threads them**: both "You've been paid — £79.20" emails collapsed into one conversation, both "New booking request — Boiler Service, £90.00" likewise, because subjects are identical. A busy provider will have every payout and every request piled into two threads. Put the reference or customer name in the subject ("You've been paid — £79.20 · Priya S · BK-…1DEE50").

### App UI — functional MVP, lacks hierarchy and personality
10. **Booking pages are a key/value readout** (label-left, value-right, full-width dividers) — reads like a form dump. The single biggest improvement is a **status stepper** (Pending → Accepted → Paid → In progress → Done → Confirmed) at the top of every booking page, so both sides see where they are and what's next. Right now status is one small pill.
11. **Button hierarchy is muddled** — bright-green "Confirm Job Complete", dark-green "Leave a Review" full-width bar, outlined-red "Cancel", grey "Message", all on one row. Pick one primary per screen.
12. **Provider profile hero is a giant grey silhouette banner** when there's no cover/photo — the first thing a customer sees. Needs a real fallback (gradient + initials or a trade icon).
13. **Dashboards are stat cards + whitespace** — "Good morning Daniel" is a nice touch, but the cards (Pending 1 / Upcoming 0 / This month £158.40 / Rating 5.0) take half the screen to say four numbers. Upcoming jobs list and the pending request should be above the fold.
14. **Earnings page** — bare bar chart; no split of available / pending clearance / on hold, which is exactly what a provider wants to know once the 7/14-day hold is real. And the numbers are wrong (Part 5 #3).
15. **Dispute card is text-heavy** — the timeline works, but the "Reported — waiting for review" state could show a 3-step progress (Reported → Provider replied → Support decision) and the £ at stake.
16. **No map / address link** on booking pages (address is plain text; emails do link it).
17. **Payment Element unstyled** (serif font) — Stripe Appearance API fix, 10 lines.
18. **Empty states are decent** ("Jobs appear here when customers book you…") — keep.
19. Mobile layout not reviewed this round.

Overall: nothing is ugly; it's a competent Tailwind-template look with the brand green. What's missing is hierarchy (what should I look at / do next) and signs of life (photos, initials, progress, colour by state). That's a design pass, not a rebuild.

## Part 6 — Still to do
- **Admin side** (rows 3–6): needs an admin login from Jordy. Case DSP-20261103-10E15D is open and waiting — resolve it from admin to complete the run.
- **Paid dispute**: BK-20261103-1DEE50 is captured (£90) and dated 4 Nov; from 4 Nov the Report link should appear — raise a dispute there to see a hold against a real payment, then resolve from admin and check the Stripe refund + webhook.
- Retest after fixes: the unpaid-complete path, confirm guards, earnings ledger.
