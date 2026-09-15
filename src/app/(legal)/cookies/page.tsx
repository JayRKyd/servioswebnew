import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Cookie Notice' }

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Notice</h1>
      <p className="meta">Servios Group Ltd · Draft pending legal review</p>

      <p>
        Servios uses a small number of cookies and similar technologies, all of
        them strictly necessary to run the service:
      </p>
      <ul>
        <li><strong>Authentication</strong> — keeps you signed in securely between pages and visits.</li>
        <li><strong>Security and preferences</strong> — protects forms against abuse and remembers basic settings.</li>
      </ul>
      <p>
        We do not currently use advertising or third-party tracking cookies. If
        that changes, this notice will be updated and we will ask for your
        consent first where the law requires it.
      </p>
      <p>
        When you first visit, a banner asks whether we may also use optional
        improvement cookies; nothing optional is set unless you choose
        &ldquo;Accept all&rdquo;. To change your choice later, clear this site&rsquo;s data in
        your browser and the banner will ask again.
      </p>
      <p>
        You can block or delete cookies in your browser settings, but blocking
        the essential ones will stop sign-in from working.
      </p>
      <p>
        For how we handle personal data generally, see our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </>
  )
}
