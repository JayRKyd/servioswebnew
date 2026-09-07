SERVIOS ROUND 3 REVIEW:


Right, ran the full verification pass on both roles with two separate accounts, then a second pass on the things the first one couldn’t reach: emails, cross‑account access, availability rules, logged‑out browsing, profile editing, filters, auth edge cases, quote requests and page metadata. Good news first: a lot of Round 3 has genuinely landed, and the email work paid off. Then the bigger stuff, because the sweeps turned up things more serious than anything on the Round 3 list. At the end there’s a design direction section, because I’ve been looking at where we sit against TaskRabbit, Checkatrade, Bark, Airbnb and Upwork and I want us building towards that from here.

WHAT’S WORKING NOW

The auth email side is sorted. Both confirmations came through in seconds, Servios branded, from notifications@servios.co.uk, and password reset works and is branded too. Wrong password, unticked terms and a reused confirmation link all get proper inline messages. Good.

Most of Round 3 checks out: service area validation, Monday week start, DD/MM date inputs, earnings defaulting to this month, the analytics axis, the profile strength meter with the completed steps shown, the edit vs preview toggle, the share popover, favourites, the escrow explainer, the customer dashboard before and after booking. Route guards hold in both directions, a customer hitting provider URLs gets bounced and vice versa. Booking a Saturday or a blocked date is rejected with clear copy. Bookmarks and the area filter work. Every profile field saves and shows on the public view, and the strength meter moved from 25% to 90% as I filled it in.

The big one, messaging attribution, is fixed. Customer and provider messages are on the right sides on both accounts and the quick replies are role specific now. That was the scariest bug from last round so good to see it properly done.

LAUNCH BLOCKERS

These are new, not from the Round 3 list, and they’re the ones that actually stop us launching.

	1.	Providers cannot open a single booking.
The customer booked a Boiler Service fine, it shows in the provider’s Requests list, but opening it, either by clicking the row or going direct to the URL, just says “Booking not found.” The detail query to Supabase is coming back as a 400. So the provider can’t accept, reject or start any job. This is the core loop of the whole platform and right now it doesn’t work. This one’s top of the list.
	2.	Fixed service prices are showing divided by 100.
Provider sets a service at £120, the public profile shows it as £1.20. Another at £90 shows as £0.90. Then the booking itself charges £100.80. That’s three different numbers for the same service. Looks like prices are being stored in pence somewhere and displayed as pounds without converting. Hourly rates are fine, it’s only the fixed service prices.
	3.	There’s content from a different product baked into the app.
The Help FAQ says “Servios operates across the Bahamas including New Providence, Grand Bahama, Abaco” and describes a landlord tenant invite system. Support hours are listed as EST. The Get Quotes results URL uses island=North+London, and every page load is querying landlord_profiles and tenant_profiles. None of that is us. Where’s this come from? Need it all stripped out, it’s a UK trades marketplace.
	4.	Uploaded verification documents can’t be retrieved.
The provider uploads their ID and insurance, but the “View file” links hit a storage bucket that doesn’t exist, returns “Bucket not found.” So whoever’s doing verification can’t actually open the documents. The whole trust model depends on this working.
	5.	Mobile is unusable.
At phone width the left sidebar never collapses, no hamburger, and the page content gets crushed into about 190px with horizontal scrolling on every single screen, both roles. The standard’s always been web and mobile, and right now mobile isn’t usable at all.
	6.	Onboarding dead ends and a visibility mismatch.
A new provider finishes onboarding and “View My Dashboard” sends them back to step 1, dashboard only shows up after a manual reload. Onboarding never asks for availability, so they land on “No working days set, customers cannot book you” and have to go find the Availability page themselves. And unverified providers are invisible in search and Get Quotes but can still be booked if you have the direct profile URL, so either the hiding or the booking is wrong.
	7.	There is no transactional email at all.
Two booking requests, a customer message, a provider reply, and neither inbox got a single email. Checked inbox and spam on both accounts. The only emails that exist are confirm signup and password reset. So a provider is never told they’ve been booked or messaged unless they happen to log in, and a customer is never told the provider replied. In‑app the provider does get a “New booking request” notification, but nothing for messages, and the customer gets nothing in‑app either. Booking request, new message and status change emails need to exist before launch, that’s the minimum.
	8.	Double booking is allowed, and past dates throw a raw database error.
Booked the same provider for 9 Sept 10:00 twice and it went straight through, there are now two identical Pending bookings on his account. And a booking for a date in the past isn’t validated at all, the form submits and the customer sees “invalid input syntax for type date” on screen. That’s a Postgres message leaking to the UI.
	9.	Trust signals can be faked from the profile page.
Type any phone number into the profile and it immediately shows “Phone: Verified” with a tick, no OTP, no check. Licences are a free text box, I typed 123456 and it displays as a licence. And the phone number is shown, clickable, on the public profile before any booking, which is an open invitation to take the job off platform. Airbnb, TaskRabbit and Upwork all hide contact details until there’s a confirmed booking. Between this and 4 the trust model is currently decorative.

QUALITY ISSUES

	10.	Turning the map on drops every provider. List view shows 3, switch to map and it’s “No providers in this area” with Filters saying “Show 0 providers.” The map’s styled nicely but the filter behind it is broken. Related: with the West London filter on, the Filters button says “Show 3 providers” and the result is 1. The count ignores the filters.
	11.	Customer “Message” buttons don’t work. On the booking detail the Message button never navigates at all, three attempts. On the provider profile it works but only on the second click after about 4 seconds with no loading feedback.
	12.	Provider list cards are mostly empty. Grey rectangles with a single initial where a photo or work thumbnail should be, and the cards are tall so it’s a lot of empty space. Hero gallery is half empty too, one side is a proper “no photos yet” state, the other is still a grey initials tile. See 24 and 26 below for where I want this to go.
	13.	Verification badges are still generic. “Documents verified” with nothing specific, even on Pete’s Plumbing whose own bio says Gas Safe registered. Should be pulling out the actual cert. See 25.
	14.	robots.txt and sitemap.xml both 404 to the raw black Next.js error page. Terms and Privacy links on signup are href=”#” and go nowhere.
	15.	Visitors can’t browse without an account. Signed out, search, provider profiles and Get Quotes all redirect to login. The landing page search box and the popular chips lead straight to a signup wall. Airbnb and Checkatrade both let you browse before you commit, that’s most of their funnel.
	16.	The Get Quotes wizard doesn’t save anything. It ends by redirecting to search with the answers stuffed into the URL. The provider’s Quote Requests page stays empty, and the Awaiting Response / Responded / Won tabs have no flow that could ever fill them. Either wire it up or take the page out.
	17.	Signup with an existing email is a dead end. It shows “Check your email, we sent a confirmation link” as if a new account was created, no email is sent, and there’s no hint to log in instead. “Resend confirmation email” on that screen says “Confirmation email resent” and also sends nothing. A returning user who forgot they have an account just gets stuck.
	18.	Customer gets no notification when the provider replies, and no unread marker in the messages list. Chat bubbles also have no timestamps. See 30.
	19.	Every page is titled “Servios”. Dashboard, search, profile, booking, messages, login, all the same tab title, and there are no Open Graph tags anywhere so shared links have no preview. Meta description and favicon are there, the rest isn’t.
	20.	Profile editing is hard to find. The “+” chips on the strength meter just scroll the page, they don’t open an editor. “No bio added yet. Click to write about yourself” does nothing when you click it. The only way in is a pencil icon that appears on hover, which doesn’t exist on touch. Several editors can be open at once too.
	21.	The direct booking form has no progress bar, no price and no summary. And the Get Quotes wizard says “STEP 1 OF 5” but the Round 3 note was 4 steps, and the final step drops the counter while the bar shows all segments filled. See 29.
	22.	Two different public profile layouts exist, /providers/{id} and /providers/{id}/profile, with the name repeated three times on one and “Member since” shown twice with different formats.
	23.	Password minimum is 6 characters, so 123456 gets through. Eight plus a mix is the floor these days.

SEED AND FAKE CONTENT

Still fake stats and testimonials all over. Landing hero has “4.8/5, 12K+ reviews”, “50K+ verified pros”, “Now in 200+ UK cities” and a floating “247 jobs posted today”. Same stats on the join provider page, the signup, login, verify email and forgot password split screens, with invented testimonials from “Sarah Mitchell” and “Pete Grant”. I know the hero numbers are getting wired to real data with a threshold, that needs to cover all these other pages too, not just the landing hero. See 31.

Customer facing seed data. A provider called “John Smith” with a gallery of four identical pepperoni pizza photos and a bio about being a carpenter for 50 years. Pete’s reviews are all authored by “Customer”. Every provider, including the one I made minutes ago, gets the line “A trusted and established member of the Servios community.” And there’s a lowercase “carpentry” category showing as a separate section from “Carpentry”.

POLISH

Smaller stuff to clean up: “Boiler Service —” booking title with a dangling dash, the “Unverified, upload docs” pill still showing after both docs are uploaded and in review, two save buttons on the Availability page, the date mask producing “25//12/202” if you type your own slashes, roadmap copy like “coming soon” showing to end users on Payouts and Billing, the landing headline animation overlapping two words mid transition, bare empty states on Requests and Notifications, the support email being support@servios.app while everything else is servios.co.uk, the Saved page calling Pete a “Plumber” while Browse says “Plumbing”, the square profile photo being stretched as the wide hero image with an empty grey third tile next to it.

DESIGN DIRECTION

Separate from the bugs. I’ve been looking at where we sit cosmetically against TaskRabbit, Checkatrade, Bark, Airbnb and Upwork. Honest read: the palette and the components are fine. The green and cream, the forms, the Get Quotes wizard, the map, the strength meter, they all hold up. The problem is the app still reads as an internal admin tool where those products read as consumer marketplaces. That gap is imagery, density and trust signals, not colours. So this is the direction I want us working towards, and some of it overlaps with the issues above.

	24.	Provider profile photo becomes mandatory in onboarding. Airbnb requires it for every host, TaskRabbit requires a face photo before a Tasker goes live, Upwork won’t approve a freelancer profile without a real photo of the person, Fiverr requires it for sellers. Checkatrade and Bark show one on nearly every profile. Gate it the same way we already gate Submit for Verification on ID and insurance. Face photo for sole traders, logo plus a face for companies, optional for customers. That kills the initials tiles in 12 at the source instead of us designing around them.
	25.	Trust badges show the actual credential, and only real ones. Checkatrade’s whole identity is this, Gas Safe, NICEIC, insurance, checks passed, with the logos. Pull the real cert type through from the documents and show it on the card and the profile alongside jobs completed and response time. That also means the free‑text licence box in 9 goes, licences come from verified documents or they don’t show.
	26.	Provider cards become dense comparison rows. Photo, rating and review count, price, availability, jobs done, one line of bio and a button, with four to six visible at once the way Bark and TaskRabbit do it. Not one tall card sitting alone in a lane with scroll arrows. The browse page’s entire job is comparison.
	27.	Provider nav slims down and collapses. Sixteen items in a fixed left rail is admin software. Competitors give providers four to six top level items and a bottom tab bar on mobile. Tradespeople live on their phones, so this goes hand in hand with fixing 5.
	28.	Empty states become onboarding moments. Requests, Notifications and Reviews are currently dashed boxes with one grey line. Airbnb and Upwork use an illustration, one sentence and one button, and the empty state tells you what to do next.
	29.	Booking keeps its context. The direct booking form needs a sticky summary card beside it, provider, service, date, price breakdown and total, the way Airbnb keeps the listing and price beside every step. Right now it’s a bare admin form.
	30.	Chat gets avatars in the bubbles, timestamps, and the booking auto linked in the Job details panel, the way Upwork keeps the contract next to the conversation. The panel already exists, it just says nothing is linked.
	31.	Stats are real or gone. Real small numbers beat invented big ones, and Airbnb and Upwork’s auth pages are quiet. Once the threshold work is done, if a number doesn’t clear it, the block comes off rather than showing a placeholder.
	32.	Type and colour. Give headings a distinct display face so the type is ours rather than anonymous, and add one warm secondary accent for primary actions so green buttons stop sitting on green heroes. Fixing the small tells (dangling dash, repeated names, emoji paperclip on Upload, black default 404) matters more than it looks, they’re what make it read as unfinished.

If we only get three of these in before launch: photos, dense trust rich cards, and the collapsing mobile nav. Those three move us from tool to marketplace faster than anything else on this list.

WHERE THIS LEAVES US

Round 3 itself is basically done, credit for that, especially the messaging fix. But 1 to 9 are all bigger than anything on the Round 3 list and all need sorting before we’re anywhere near launch. Order I’d go in: booking‑not‑found first because nothing downstream can be tested without it, then pricing, then transactional email, then double booking and the past date validation, then the Bahamas content and the document bucket, then the phone verified / public phone / free‑text licence trio. Mobile and the onboarding dead ends after that. The design direction is the round after, but 24, 26 and 27 are close enough to 5 and 12 that it’s worth planning them together rather than patching the cards twice.

Heads up on test data: the provider account faizaansaeeed+prov1 now has two identical 9 Sept 10:00 bookings from the double booking test, and its profile has been filled in with placeholder photos, a £55 rate and a fake licence. Leave them, they’re useful for retesting once the booking fix lands. Once you’ve shipped, I’ll rerun the whole set, the original 44 plus the 9 follow ups, and the full accept to review lifecycle on top.

Full reports with screenshots for every item if you want to see any of them.