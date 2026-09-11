# Design round — items 24–32 from the Round 3 review

Client's own priority: **24 (photos), 26 (dense cards), 27 (mobile nav)** —
"those three move us from tool to marketplace faster than anything else."
Status audit first, then the plan in build order.

## Already done (shipped in earlier rounds)

- **29** Booking context — sticky summary card beside the booking form. ✅
- **31** Stats real or gone — every invented number is gone from hero, auth
  panels, join-provider, service tiles. The "wire real numbers above a
  threshold" half only matters once real numbers exist; when traffic arrives,
  add a stats endpoint with display thresholds (e.g. show reviews ≥ 25,
  providers ≥ 50). Deferred deliberately, nothing fake is showing meanwhile.
- **28 (partial)** Requests and Notifications have proper empty states.
- **30 (partial)** Chat timestamps shipped.
- **32 (partial)** Dangling dash, repeated names, duplicate profile layout
  already fixed.

---

## Phase A — the client's top three

### 27. Provider nav slims down + mobile bottom tab bar — L
Current: 16 flat items in the provider rail (admin-software smell).
Target: 5 top-level groups, and on mobile a bottom tab bar (thumb reach).

Grouping (12 provider routes + 5 shared → 5 groups):
| Group | Contains |
|---|---|
| Home | /provider dashboard |
| Jobs | Requests, Calendar, Availability |
| Quotes | Quote Requests |
| Messages | Messages (badge carries unread count) |
| Business | Earnings, Payouts, Analytics, Profile, My Services, Documents, Reviews |

- Desktop sidebar: groups become section headers with the sub-items nested
  (collapsed by default except the active group).
- Mobile: `BottomTabBar` component (fixed bottom, 5 tabs, badges on Messages)
  replacing the drawer as primary provider navigation; drawer stays for the
  long tail. Customer role can adopt the same pattern later.
- Files: `Sidebar.tsx` (grouped config), new `BottomTabBar.tsx`,
  `(dashboard)/layout.tsx` (render tab bar for provider on mobile, pad main).

### 26. Provider cards become dense comparison rows — L
Current: tall Airbnb-style cards, one per lane, mostly empty for new providers.
Target: Bark/TaskRabbit comparison rows — 4–6 visible at once:

```
[photo 72px] Pete's Plumbing Co  ★4.9 (2) · 12 jobs · ~1h response
             Gas Safe Registered · Insured          [badges from docs]
             "Family-run plumbing business serving…"  [one line, truncated]
             North London · from £55/hr                    [View profile]
```

- New `ProviderRow` component; search list, map side-list, and Saved page all
  switch to it. Grid/carousel modes go; the browse page's job is comparison.
- Thumbnail priority: profile photo → first portfolio photo → initials tile
  (initials become rare once item 24 gates photos).
- Badges come from item 25's verified-documents work (build 25 first).
- Keep `AirbnbProviderCard` only if the map hover-card needs it; otherwise delete.

### 24. Provider photo mandatory in onboarding — M
- Onboarding Documents step gains a required **Profile photo** upload at the
  top (same gate pattern as ID/insurance: Submit stays disabled without it).
  Copy: face photo for sole traders, logo + face for companies.
- Reuse the avatar upload path from provider profile (same storage bucket).
- Existing photo-less providers: profile-strength meter already nags; add a
  dashboard banner "Profiles with photos win N× more jobs — add yours".
- Customers stay optional (client said so).

## Phase B — trust + chat + polish

### 25. Real credential badges (also closes review #13) — M
- Badge source: `provider_documents` with `status in (verified, approved)` —
  document_type + title ("Gas Safe Registered", "Public Liability Insurance").
- Show on: provider rows (26), profile Verifications block (replacing the
  generic "Documents verified" line with the actual cert names), booking
  summary card.
- Free-text licences: display goes entirely (input can stay as a private
  prompt to upload the actual cert, or be removed — recommend removed).
- Admin verification flow already sets the statuses; no new review tooling.

### 30 remainder. Chat: avatars in bubbles + booking auto-linked — S/M
- Avatars: fetch both participants' profile photos once per conversation,
  render 24px avatar beside incoming bubbles (Upwork style).
- Job details panel: when `conversation.booking_id` is set the panel already
  gets data; fix the "nothing linked" state by auto-linking the latest active
  booking between the two parties when the conversation has no booking_id
  (or show "No booking yet — request one" CTA for direct conversations).

### 28 remainder. Empty states as onboarding moments — S
Sweep the remaining bare ones (Reviews, Earnings, Calendar, provider
Analytics, customer Bookings) into the icon + one sentence + one button
pattern already used on Requests/Notifications/Saved.

### 32. Type & colour — M (needs client sign-off on the choices)
- **Display face for headings**: propose one distinctive face (loaded via
  next/font, self-hosted) — candidates: Bricolage Grotesque (warm,
  contemporary) or Sora (geometric, techy). Body stays system/Inter-ish.
- **Warm secondary accent** for primary actions sitting on green surfaces
  (hero CTA, auth panel buttons): propose amber-500 family, used sparingly —
  one accent, not a rainbow.
- Remaining small tells: replace the emoji 📎 on document Upload buttons with
  a lucide icon; branded `not-found.tsx` (the black default 404 the client
  hit); audit pass for stray emoji/placeholder copy.
- Deliverable first: a one-page style preview (headings, buttons, card) for
  the client to approve before it's applied app-wide.

---

## Build order & sizing

1. **25** cert badges (M) — 26 depends on it
2. **26** dense rows (L)
3. **27** nav + bottom tabs (L)
4. **24** photo gate (M)
5. **30/28** chat + empty states (S/M)
6. **32** type & colour (M, gated on approving the style preview)

Roughly three working sessions. Everything except 32's font/accent choice is
decision-free; that one gets a visual preview before rollout.
