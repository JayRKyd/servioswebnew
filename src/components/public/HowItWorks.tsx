export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Tell us what you need',
      desc: 'Answer a few quick questions about your job — what, where, and when.',
    },
    {
      num: '02',
      title: 'Get matched with pros',
      desc: "We'll send your request to vetted professionals in your area. Expect quotes within hours.",
    },
    {
      num: '03',
      title: 'Compare, hire, review',
      desc: 'Check profiles, read reviews, compare prices. Book the right person and leave feedback after.',
    },
  ]

  return (
    <section id="how-it-works" className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="max-w-lg mb-12 sm:mb-16">
          <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">How it works</p>
          <h2 className="text-[1.75rem] sm:text-[2rem] font-bold text-dark tracking-[-0.02em]">Three steps. No fuss.</h2>
          <p className="mt-3 text-[16px] text-muted leading-relaxed">
            Whether it&apos;s a leaky tap or a full kitchen refit, the process is the same.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-10">
          {steps.map(({ num, title, desc }) => (
            <div key={num} className="relative">
              <span className="text-[48px] sm:text-[56px] font-bold text-border/70 leading-none select-none">{num}</span>
              <h3 className="text-[17px] font-semibold text-dark mt-3 mb-2">{title}</h3>
              <p className="text-[14.5px] text-muted leading-[1.6]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
