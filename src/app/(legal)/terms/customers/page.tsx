import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Customer Terms' }

export default function CustomerTermsPage() {
  return (
    <>
      <h1>Customer Terms of Service</h1>
      <p className="meta">Servios Group Ltd · Draft pending legal review</p>

      <h2>1. Who we are and what Servios is</h2>
      <p>
        Servios is operated by Servios Group Ltd, a company registered in England
        &amp; Wales (&ldquo;Servios&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). Servios is an online marketplace that
        connects customers with independent trade professionals (&ldquo;providers&rdquo;).
        We are not a building, trades or repair company: the contract for any work
        booked through Servios is between you and the provider. We provide the
        platform, secure payment handling and support around it.
      </p>

      <h2>2. Your account</h2>
      <p>
        You must be at least 18 and able to enter into contracts to use Servios.
        Keep your account details accurate and your password private — you are
        responsible for activity on your account. We may suspend or close accounts
        that break these terms or misuse the platform.
      </p>

      <h2>3. Bookings</h2>
      <p>
        A booking is a request until the provider accepts it. Once accepted, you
        and the provider have an agreement for the work described in the booking
        at the price shown. Give the provider accurate information about the job,
        reasonable access to the property, and a safe working environment.
      </p>

      <h2>4. Prices and payment</h2>
      <p>
        Using Servios is free for customers: the price you see is the price you
        pay, and we add no service fees or surcharges. Servios earns a commission
        from the provider&rsquo;s side of the transaction.
      </p>
      <p>
        Payments are handled through the platform. When you book, your payment is
        collected and held securely (&ldquo;escrow&rdquo;). It is released to the provider
        when you confirm the work is complete. If you don&rsquo;t confirm or raise a
        dispute within a reasonable period after the provider marks a job
        complete, we may release the payment after giving you notice. Paying
        providers outside the platform is not permitted for work arranged through
        Servios and removes the protections these terms give you.
      </p>

      <h2>5. Cancellations</h2>
      <p>
        You can cancel a booking free of charge up to 24 hours before the
        scheduled start time. For later cancellations, or if you fail to provide
        access at the scheduled time, we may charge a reasonable cancellation fee
        reflecting the provider&rsquo;s lost time. Providers can also cancel; if that
        happens you receive a full refund of anything paid for that booking.
      </p>

      <h2>6. If something goes wrong</h2>
      <p>
        If work is incomplete or not as agreed, don&rsquo;t confirm completion — contact
        the provider through Servios messaging first, and if you can&rsquo;t resolve it,
        raise it with us at <a href="mailto:support@servios.co.uk">support@servios.co.uk</a>.
        While a dispute is open we may hold the escrowed payment until it is
        resolved. Our role in disputes is as a neutral intermediary; the underlying
        contract remains between you and the provider. Nothing in these terms
        affects your statutory rights.
      </p>

      <h2>7. Reviews and conduct</h2>
      <p>
        Reviews must be honest and based on your genuine experience. Don&rsquo;t use
        Servios to harass, discriminate, spam, or arrange work off-platform to
        avoid payment protections. We may remove content or restrict accounts
        that breach this.
      </p>

      <h2>8. Our liability</h2>
      <p>
        Providers on Servios are independent businesses. While we verify identity
        and require documents before providers go live, we do not supervise their
        work and are not responsible for its quality — your remedies for the work
        itself are against the provider. We are responsible for operating the
        platform with reasonable care and skill. Nothing in these terms excludes
        liability that cannot be excluded by law, including for death or personal
        injury caused by negligence.
      </p>

      <h2>9. Changes and ending your account</h2>
      <p>
        We may update these terms — if we make material changes we&rsquo;ll tell you in
        advance. You can close your account at any time; bookings already in
        progress remain subject to these terms until completed or cancelled.
      </p>

      <h2>10. Law and disputes with us</h2>
      <p>
        These terms are governed by the law of England and Wales, and the courts
        of England and Wales have jurisdiction (if you live in Scotland or
        Northern Ireland, you may also bring proceedings there).
      </p>

      <p>
        See also the <Link href="/terms/providers">Provider Terms</Link>,{' '}
        <Link href="/privacy">Privacy Policy</Link> and{' '}
        <Link href="/cookies">Cookie Notice</Link>.
      </p>
    </>
  )
}
