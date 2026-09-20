# Round 5 — client findings (2026-09-22)

Client corrected their own freeze methodology: it was never the photos — it's
the **status-change buttons**. Sign-off needs: both blockers fixed, then one
clean booking run through to completed (completion emails + second review).
Provider password is back to the client's own (`Round3Verify!2026`).

## Blockers

### 1. Status buttons freeze the tab (the real shape of the "photo freeze")
Corrected evidence:
- Fresh booking (scheduled 29th), no photos. Accept → fine. **Mark In
  Progress → froze, twice, nothing saved.**
- Last week: Accept + Mark In Progress fine, **Mark Completed froze but the
  update SAVED** (earnings show £158.40 across two jobs — escrow release
  works).
- Accept has never failed. "Which one breaks keeps changing."

Diagnostic reading (not yet confirmed):
- The freezing buttons are exactly the ones that call **native `alert()` /
  `confirm()` dialogs**; Accept (future booking) shows none.
  - Mark Completed: `confirm()` when there are no after-photos (last week's
    freeze — and it saved when confirmed, matching "froze but landed").
  - Mark In Progress: the new before-schedule **`alert()` guard** — the
    client's booking is for the 29th, so the guard fired and correctly
    refused to save. If the dialog never became visible (or Chrome's
    "prevent additional dialogs" was ticked earlier in their long test
    sessions), a native dialog blocks the page invisibly = looks exactly
    like a hard freeze, forever, with no save.
- Fix: **remove every native alert/confirm from the booking flows** and
  replace with inline banners/confirm buttons (also better UX — competitors
  don't use native dialogs); audit `updateStatus` for anything that could
  hang after the write. Then the schedule guard shows as a visible inline
  notice instead of a suppressible dialog.
- Stuck booking for verification: `01356506-a3c3-4bf6-bc81-f630fadff766`
  (status Accepted, nothing to repair server-side).

### 2. Get Quotes location step is dead
Pick an area → highlights → nothing. No network request at all. Was flaky on
the 15th, fully dead now. Regression window includes the spinner/one-pick
guard change — the guard means a silently-failed first click makes all
retries no-ops. Needs local reproduction; suspicion: an exception between the
click and `router.push`, swallowed without UI.

## Email content round (design fine, content thin)

3. **Provider booking-request email** (most important): add **price** and
   **location/address**, plus the **customer's notes** — who/what/when is
   already there; how-much and where are what a tradesperson decides on.
4. **All emails: show the other person.** Photo, name, rating at the top
   (Airbnb/TaskRabbit/Upwork all do); details as a small card — service,
   provider/customer, date, time, location, price — not one sentence.
5. **Multiple CTAs**: message them / cancel / view profile alongside the
   primary button. Help link in the footer. (Notification preferences page —
   bigger feature, propose deferring.)
6. **Footer**: more than the company name; add help/contact links.
7. **Dark mode**: colours are hard-coded; add dark-scheme-safe styling.

## Company details (client supplied — add everywhere)

> Servios Group Ltd · Registered in England & Wales · Company No. 16840842
> Registered office: 167-169 Great Portland Street, London, W1W 5PF

Targets: email footer template, site footer, legal pages.

## Order

1. Blocker 1 — replace native dialogs with inline UI + updateStatus audit
2. Blocker 2 — quote wizard location step
3. Provider booking-request email content (price, location, notes)
4. Email redesign: person card + details card + CTA row + footer + company
   details + dark-mode-safe colours (one pass over the renderer)
5. Company details on site footer + legal pages
6. Hand to client for the clean end-to-end run
