import Link from 'next/link'
import { ServiosMark } from '@/components/brand/Logo'

// Real destinations only — dead # links and pages that don't exist yet
// (About, Careers…) stay out until they do
const links: Record<string, { label: string; href: string }[]> = {
  Services: [
    { label: 'Cleaning', href: '/book?query=Cleaning' },
    { label: 'Plumbing', href: '/book?query=Plumbing' },
    { label: 'Electrical', href: '/book?query=Electrical' },
    { label: 'Painting & Decorating', href: '/book?query=Painting' },
    { label: 'Gardening', href: '/book?query=Gardening' },
    { label: 'Handyman', href: '/book?query=Handyman' },
  ],
  Explore: [
    { label: 'Browse providers', href: '/search' },
    { label: 'Get quotes', href: '/book' },
    { label: 'Become a provider', href: '/join-provider' },
  ],
  Support: [
    { label: 'Help Centre', href: '/help' },
    { label: 'Contact us', href: 'mailto:support@servios.co.uk' },
  ],
  Legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Cookie Notice', href: '/cookies' },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <ServiosMark size={24} />
              <span className="text-[15px] font-semibold text-[#171717] tracking-[-0.02em]">servios</span>
            </Link>
            <p className="text-[13.5px] text-muted leading-[1.6] max-w-[260px]">
              Connecting homeowners with trusted local professionals across the United Kingdom.
            </p>
          </div>

          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-[12px] font-semibold text-dark uppercase tracking-wider mb-3">{heading}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} className="text-[13.5px] text-muted hover:text-dark transition-colors">{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            &copy; 2026 Servios Group Ltd · Registered in England &amp; Wales · Company No. 16840842<br />
            Registered office: 167-169 Great Portland Street, London, W1W 5PF
          </p>
          {/* Social links return when the profiles exist — no dead # links */}
        </div>
      </div>
    </footer>
  )
}
