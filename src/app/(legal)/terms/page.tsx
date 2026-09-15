import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsHubPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="meta">Servios Group Ltd · Draft pending legal review</p>
      <p>
        Servios is an online marketplace operated by Servios Group Ltd that connects
        customers with independent trade professionals across the UK. Because the
        deal is different on each side of the marketplace, our terms are split in two:
      </p>
      <ul>
        <li>
          <Link href="/terms/customers">Customer Terms</Link> — for anyone booking
          services through Servios: bookings, payments, cancellations and your
          responsibilities.
        </li>
        <li>
          <Link href="/terms/providers">Provider Terms</Link> — for trade
          professionals offering services: verification, commission, payouts and
          your obligations.
        </li>
      </ul>
      <p>
        Both sets of terms apply together with our{' '}
        <Link href="/privacy">Privacy Policy</Link> and{' '}
        <Link href="/cookies">Cookie Notice</Link>. By creating an account you agree
        to the terms that apply to your role — and if you hold both roles, both apply.
      </p>
    </>
  )
}
