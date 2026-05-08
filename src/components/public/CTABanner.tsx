import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function CTABanner() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="relative bg-dark rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-primary" />

          <div className="px-6 py-14 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-[1.75rem] sm:text-[2.25rem] font-bold text-white tracking-[-0.02em] leading-tight">
                  Ready to get your <br className="hidden sm:block" />next job sorted?
                </h2>
                <p className="mt-4 text-[16px] text-gray-400 leading-relaxed max-w-md">
                  Whether you&apos;re looking for help or looking for work, Servios has you covered. Join 50,000+ users across the UK.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 lg:justify-end">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-white text-dark font-medium text-[15px] px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors">
                  Find a Professional
                  <ArrowRight size={16} />
                </Link>
                <Link href="/join-provider" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-medium text-[15px] px-6 py-3 rounded-lg hover:bg-white/15 transition-colors border border-white/10">
                  Join as a Provider
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
