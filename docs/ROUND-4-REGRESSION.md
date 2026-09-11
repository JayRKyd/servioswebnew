# Round 4 regression — client findings on deploy fd6a31f6

Client re-ran the full set (original 44 + 9 follow-ups + the complete
accept → in-progress → complete → review lifecycle) after the Sidebar
hotfix. Recorded 2026-09-10.

## Confirmed fixed by the client

Launch blockers 1, 2, 3, 5, 8, 9 and most of quality items 10–23:
mobile nav, booking detail, prices, Help copy, double booking,
phone/licence trust trio, map + filter counts, message buttons,
logged-out browsing, duplicate-email signup, password policy, page
titles, credential badges, empty states, fake stats. The full booking
lifecycle runs end to end and the review shows everywhere it should.
The signed-in crash is gone.

## Still open from the original list

| # | Finding | Notes / suspicion |
|---|---|---|
| **7** | **Transactional email: still zero.** Seven events this round (accepted, started, completed, review, new booking, message both ways) — neither inbox received anything. In-app notifications work. | Pipeline WAS verified live on 7 Sept (trigger → dispatch 200 → Resend delivered). Something regressed since: check `net._http_response` for 401/500s (SYNC_SECRET drift again?), Vercel RESEND_* vars, and whether the triggers survived. |
| **6** | **Availability page regression.** Every day shows 06:00–06:00 instead of the saved 09:00–17:00, Save is enabled — a provider opening the page and saving wipes their real hours. | New since the availability/onboarding work. 06:00 is the first TIME_SLOTS entry → smells like the load mapping returns null/undefined and the select falls to the first option instead of the 09:00/17:00 defaults. Destructive-on-save makes this the top fix. |
| **16** | **Quotes half-connected.** Customer side works (My Quotes shows the request) but the provider's Quote Requests page stays empty — nothing reaches anyone. | Invite inserts are fire-and-forget from the wizard; either the insert fails silently (RLS?) or the provider-side SELECT path (`get_provider_invited_quote_request_ids`) doesn't see customer-created requests. Check quote_request_providers rows for Priya's request. |

### Small ones
- Past-date error: says "please enter a valid date" for a valid date and
  sticks after the date is fixed (validation state doesn't clear).
- Password error on signup shows the raw Supabase string.
- `/terms` and `/privacy` redirect to the dashboard when logged in —
  they're missing from AUTHED_ACCESSIBLE_PUBLIC in the middleware.

## New findings from the lifecycle (in the client's order)

| ID | Finding | Severity |
|---|---|---|
| **A** | **Escrow releases on the provider's word.** Provider hits Mark Completed → instantly "Payment released, £79.20" and customer sees "£90.00 sent to provider" — no customer-confirm step, contradicting the booking card, Payouts page and the customer's own notification copy. No real money moves yet (no payment collection) so it's the state machine — but it can't ship like this. Also nothing prevents accepting/completing a booking whose date has passed. | Launch blocker |
| **B** | **Stripe publishable key undefined in production.** Every customer booking page throws "Expected publishable key to be of type string, got type undefined". And a booking for Pete's Bathroom Installation (no price set) went through at £0.00 with no breakdown and no payment step. | Launch blocker — env var (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` missing in Vercel; local has a placeholder) + a guard for priceless services |
| **C** | **Job photos broken.** Before-photo upload posts to booking_photos and gets 400 "null value in column url violates not-null constraint"; no user feedback; file never reaches storage. | High — booking_photos insert uses storage_path but the table demands url; likely also the missing `booking-photos` bucket (item 4 family) |
| **D** | **Duplicate customer notifications** with different wording (Booking accepted / Booking accepted!, Job started ×2, Job marked complete / Job completed). | Medium — the dispatch-route in-app notification now double-writes with pre-existing client-side inserts; dedupe to one source |
| **E** | **Numbers disagree.** Provider list £100.80 vs detail £90 job/£79.20 payout; customer told £90 sent and fee "0.12%"; Analytics £90 net vs Earnings £79.20 net; profile 0 jobs vs Earnings 1. Cancelled duplicate counts as 50% cancellation rate. **Root cause (screenshot R-14): commission is charged on BOTH sides** — checkout adds 12% on top (customer pays £100.80 for a £90 job) while the payout view deducts 12% from base (provider gets £79.20). Effective platform take is 24% against copy that says 12%. | Medium-high — needs a business decision first: fee on top (customer pays) or fee out of base (provider pays). Then one shared money module: single commission model, pence everywhere, one formatter, plus jobs counter + cancellation-rate fixes |
| **F** | **Foreign conversation URL renders an empty chat** with a live Send box. Sends are refused and nothing leaks, but it should 404 and the user gets no error feedback. | Low-medium — guard: viewer must be a participant |
| **G** | **Calendar shows no marker** for the completed 9 Sept job. | Low |

## Test-data notes from the client

- Daniel is unverified → unbookable (correct behaviour); use Pete's for
  further booking tests until Daniel is verified.
- The 9 Sept booking is Completed and reviewed.
- Priya has a £0.00 Pete's booking for 23 Sept and one open quote request.

## Suggested fix order

1. **6** (destructive save — data loss on an innocent visit)
2. **7** (email — regressed after being verified; diagnose the pipeline)
3. **16** (quotes provider side — completes the flow the client just praised)
4. **B** (Stripe key env + £0 booking guard)
5. **A** (escrow state machine: customer-confirm gate + past-date guards)
6. **C** (photo upload)
7. **D**, small ones (terms/privacy middleware, date error stickiness, password copy)
8. **E** (single money-formatting pass + counters), **F**, **G**
