import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Provider Terms' }

export default function ProviderTermsPage() {
  return (
    <>
      <h1>Provider Terms of Service</h1>
      <p className="meta">Servios Group Ltd · Draft pending legal review</p>

      <h2>1. The relationship</h2>
      <p>
        Servios is a marketplace operated by Servios Group Ltd (registered in
        England &amp; Wales). As a provider you are an independent business, not an
        employee, worker, agent or partner of Servios. You decide which jobs to
        take, set your own prices and working hours, and are responsible for your
        own tax, National Insurance and business affairs. The contract for each
        job is between you and the customer.
      </p>

      <h2>2. Verification</h2>
      <p>
        Before your profile goes live you must complete verification: a profile
        photo, government photo ID, and proof of public liability insurance, plus
        any qualifications legally required for your trade (for example Gas Safe
        registration for gas work). We review documents before approving them,
        show customers only credentials we have verified, and may re-verify or
        ask for updated documents at any time. Keeping your insurance and any
        required registrations current is a condition of staying live on the
        platform.
      </p>

      <h2>3. Listings, quotes and bookings</h2>
      <p>
        Your services, prices and profile must be accurate and kept up to date.
        Accepting a booking or having a quote accepted creates an agreement with
        the customer for the work described at the agreed price. Keep your
        availability calendar accurate — customers can only book the hours you
        publish.
      </p>

      <h2>4. Commission and payouts</h2>
      <p>
        Customers pay the listed price; Servios charges you a commission on each
        completed job, deducted from the job amount before payout:
      </p>
      <ul>
        <li>12% on standard bookings</li>
        <li>15% on emergency bookings</li>
        <li>10% on bookings through the landlord programme</li>
      </ul>
      <p>
        Customer payments are held securely by the platform and your payout
        (the job amount minus commission) is released after the customer
        confirms completion, or after a dispute is resolved in your favour.
        Receiving payouts may require completing onboarding with our payment
        processor, including identity and bank account checks.
      </p>

      <h2>5. Staying on-platform</h2>
      <p>
        Jobs arranged through Servios must be transacted through Servios. Don&rsquo;t
        solicit or accept off-platform payment for platform-originated work, and
        don&rsquo;t share contact details for that purpose before a booking exists.
        Circumventing commission is grounds for removal.
      </p>

      <h2>6. Standards of work and conduct</h2>
      <p>
        You agree to perform work with reasonable care and skill, comply with all
        applicable law and safety regulations, hold the qualifications the work
        requires, turn up on time or communicate promptly when you can&rsquo;t, and
        treat customers respectfully. Repeated cancellations, no-shows, poor
        reviews or complaints may lead to reduced visibility, suspension or
        removal.
      </p>

      <h2>7. Insurance and liability</h2>
      <p>
        You must maintain public liability insurance appropriate to your trade
        for as long as you accept work through Servios. You are responsible for
        the work you perform and for any damage or loss it causes; Servios is
        responsible for operating the platform with reasonable care and skill,
        and is not a party to your contract with the customer. Nothing in these
        terms excludes liability that cannot be excluded by law.
      </p>

      <h2>8. Reviews and data</h2>
      <p>
        Customers may review completed jobs; reviews reflecting genuine
        experiences will not be removed just because they are negative. Customer
        contact details and job information are provided for performing the work
        only and must be handled in line with data protection law and our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>9. Suspension, termination and changes</h2>
      <p>
        You can stop accepting work or close your account at any time; jobs
        already accepted should be completed or properly cancelled. We may
        suspend or remove accounts that breach these terms, fail verification,
        or put customers at risk. We may update these terms with reasonable
        notice of material changes.
      </p>

      <h2>10. Law</h2>
      <p>
        These terms are governed by the law of England and Wales and the courts
        of England and Wales have exclusive jurisdiction.
      </p>

      <p>
        See also the <Link href="/terms/customers">Customer Terms</Link>,{' '}
        <Link href="/privacy">Privacy Policy</Link> and{' '}
        <Link href="/cookies">Cookie Notice</Link>.
      </p>
    </>
  )
}
