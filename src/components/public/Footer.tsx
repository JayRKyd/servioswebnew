const links = {
  Services: ['Cleaning', 'Plumbing', 'Electrical', 'Painting & Decorating', 'Gardening', 'Handyman'],
  Company: ['About', 'Careers', 'Press', 'Blog'],
  Support: ['Help Centre', 'Contact Us', 'Trust & Safety'],
  Legal: ['Terms of Service', 'Privacy Policy', 'Cookie Policy'],
}

export default function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-10">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <a href="/" className="flex items-center gap-2.5 mb-4">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="#115e56" />
                <path d="M8 18.5C8 18.5 9.5 16 14 16C18.5 16 20 18.5 20 18.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="11" r="3.5" stroke="white" strokeWidth="2" />
              </svg>
              <span className="text-[15px] font-semibold text-dark tracking-[-0.01em]">Servios</span>
            </a>
            <p className="text-[13.5px] text-muted leading-[1.6] max-w-[260px]">
              Connecting homeowners with trusted local professionals across the United Kingdom.
            </p>
          </div>

          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-[12px] font-semibold text-dark uppercase tracking-wider mb-3">{heading}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13.5px] text-muted hover:text-dark transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[12px] text-muted">&copy; 2026 Servios Ltd. Registered in England &amp; Wales.</p>
          <div className="flex items-center gap-5">
            {['Twitter', 'LinkedIn', 'Instagram'].map((s) => (
              <a key={s} href="#" className="text-[12px] text-muted hover:text-dark transition-colors">{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
