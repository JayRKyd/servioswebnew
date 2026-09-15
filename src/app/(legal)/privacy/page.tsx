import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="meta">Servios Group Ltd · Draft pending legal review</p>

      <p>
        This policy explains how Servios Group Ltd (&ldquo;Servios&rdquo;, &ldquo;we&rdquo;), registered
        in England &amp; Wales, handles personal data when you use the Servios
        marketplace — whether as a customer or a provider. We are the data
        controller for the platform. Contact us about privacy at{' '}
        <a href="mailto:support@servios.co.uk">support@servios.co.uk</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data</strong> — name, email, password (stored hashed), role, phone number if you add one.</li>
        <li><strong>Profile data</strong> — for providers: business details, bio, photo, services, prices, service areas, availability.</li>
        <li><strong>Verification documents</strong> — for providers: photo ID, insurance and qualification documents, stored privately and accessible only to you and our verification team.</li>
        <li><strong>Booking and job data</strong> — bookings, quotes, job photos, reviews and messages sent through the platform.</li>
        <li><strong>Payment data</strong> — processed by our payment provider (Stripe); we hold transaction records but not full card numbers.</li>
        <li><strong>Usage data</strong> — log and device information needed to run and secure the service.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li><strong>To provide the service</strong> (contract) — accounts, matching, bookings, messaging, payments and payouts, notifications about your bookings and messages.</li>
        <li><strong>Trust and safety</strong> (legitimate interests / legal obligation) — verifying providers, preventing fraud and misuse, resolving disputes.</li>
        <li><strong>Improving Servios</strong> (legitimate interests) — understanding how the platform is used and fixing problems.</li>
        <li><strong>Marketing</strong> (consent) — only if you opt in, and you can withdraw at any time.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        The other party to your booking sees what they need: customers see
        provider profiles and verified credentials; providers see the customer
        name, job details and address needed to do the work. We also use service
        providers to run the platform — hosting and database (Vercel, Supabase),
        payments (Stripe), email (Resend), search (Algolia) and maps (Mapbox) —
        each processing data under contract with us. We share data with
        authorities where the law requires it. We do not sell personal data.
      </p>

      <h2>International transfers</h2>
      <p>
        Some service providers process data outside the UK. Where they do, we
        rely on appropriate safeguards such as the UK International Data Transfer
        Agreement or adequacy regulations.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account and booking records are kept while your account is active and
        for as long afterwards as we need them for legal, tax and dispute
        purposes. Verification documents are kept while you are an active
        provider and deleted within a reasonable period after your account
        closes, unless we must keep them longer by law.
      </p>

      <h2>Your rights</h2>
      <p>
        Under UK GDPR you can ask for access to your data, correction, deletion,
        restriction, portability, and you can object to processing based on
        legitimate interests. Email{' '}
        <a href="mailto:support@servios.co.uk">support@servios.co.uk</a> to
        exercise any of these. You can also complain to the Information
        Commissioner&rsquo;s Office (<a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>).
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is role-restricted, verification
        documents live in private storage, and payment details are handled by
        our payment processor rather than stored by us.
      </p>

      <h2>Cookies and changes</h2>
      <p>
        See our <Link href="/cookies">Cookie Notice</Link> for the small number
        of cookies we use. If we make material changes to this policy we&rsquo;ll
        notify you through the platform or by email.
      </p>
    </>
  )
}
