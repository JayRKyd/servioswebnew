'use client'
import { useEffect, useState } from 'react'
import {
  ArrowRight, Star, PoundSterling, Clock, Users,
  TrendingUp, Shield, Calendar, MapPin, Zap, ChevronDown,
  CheckCircle2, Briefcase, CircleDollarSign, BarChart3
} from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'

const earningsData = [
  { trade: 'Plumber', hourly: '£45–80', monthly: '£4,200', jobs: '18/mo avg' },
  { trade: 'Electrician', hourly: '£40–70', monthly: '£3,800', jobs: '16/mo avg' },
  { trade: 'Cleaner', hourly: '£15–30', monthly: '£2,600', jobs: '24/mo avg' },
  { trade: 'Painter', hourly: '£20–45', monthly: '£3,100', jobs: '12/mo avg' },
  { trade: 'Gardener', hourly: '£18–35', monthly: '£2,400', jobs: '20/mo avg' },
  { trade: 'Handyman', hourly: '£25–50', monthly: '£2,900', jobs: '22/mo avg' },
]

const steps = [
  { title: 'Sign up and create your profile', desc: 'Tell us about your services, experience, and working area. Add photos of past work to stand out. Takes under 2 minutes.', icon: Briefcase },
  { title: 'Get verified', desc: 'Complete ID verification and add qualifications. Verified pros get 3x more leads and build trust instantly with customers.', icon: Shield },
  { title: 'Set your rates and availability', desc: 'You decide what to charge and when you work. Set your service radius, toggle availability on and off anytime.', icon: Calendar },
  { title: 'Receive leads and start earning', desc: 'Get notified when customers post jobs in your area. Send quotes, get hired, do great work, earn reviews. Repeat.', icon: CircleDollarSign },
]

const benefits = [
  { text: 'Low fees, more in your pocket', icon: PoundSterling },
  { text: 'Set your own hours and radius', icon: Clock },
  { text: 'Verified profile builds trust', icon: Shield },
  { text: 'Instant notifications for new jobs', icon: Zap },
  { text: 'In-platform secure payments', icon: CircleDollarSign },
  { text: 'Grow with ratings and reviews', icon: TrendingUp },
]

const categories = [
  'Cleaning', 'Plumbing', 'Electrical', 'Painting & Decorating', 'Gardening',
  'Handyman', 'Removals', 'Pest Control', 'Locksmith', 'Roofing',
  'Plastering', 'Tiling', 'Carpentry', 'Gas Engineering', 'Security Systems',
  'Photography', 'Catering', 'Personal Training',
]

const testimonials = [
  { name: 'Daniel Roberts', trade: 'Plumber', location: 'Manchester', text: "Within my first month I had 14 booked jobs. The leads are genuine and customers are serious — best platform I've used by a mile.", rating: 5, earnings: '£3,200', period: '/month avg', img: 'https://i.pravatar.cc/80?img=12' },
  { name: 'Amara Koroma', trade: 'Cleaner', location: 'London', text: 'I went from 2 regular clients to 15 in three months. Being verified makes a huge difference — customers trust you immediately.', rating: 5, earnings: '£2,800', period: '/month avg', img: 'https://i.pravatar.cc/80?img=45' },
  { name: 'Tom Shelby', trade: 'Electrician', location: 'Birmingham', text: "The fees are fair and transparent. I set my own prices, pick my own jobs, and I'm genuinely earning more while working less.", rating: 5, earnings: '£4,500', period: '/month avg', img: 'https://i.pravatar.cc/80?img=53' },
]

const faqs = [
  { q: 'Is it free to sign up?', a: 'Yes, creating your profile is completely free. We offer a free tier with limited leads per month, and paid plans that give you unlimited leads and priority placement.' },
  { q: 'What do I need to get verified?', a: 'A valid UK photo ID, proof of address, and relevant qualifications or certifications for your trade. The process usually takes 24–48 hours.' },
  { q: 'How do I get paid?', a: "You agree pricing directly with the customer. Payments can be handled through our secure platform or arranged directly — it's up to you." },
  { q: 'What areas do you cover?', a: "Servios is available across 200+ cities in England, Scotland, and Wales. We're expanding to Northern Ireland soon." },
  { q: 'Do I need insurance?', a: 'We recommend public liability insurance for all trades. We partner with leading insurers to offer discounted policies to our verified providers.' },
  { q: 'Can I pause my account?', a: "Absolutely. Toggle your availability on or off anytime. Going on holiday? Pause leads with one click and resume when you're back." },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left group">
        <span className="text-[15px] font-medium text-dark pr-8 group-hover:text-primary transition-colors">{q}</span>
        <ChevronDown size={18} className={`text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="text-[14.5px] text-muted leading-[1.65] max-w-2xl">{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function JoinProviderPage() {
  const [selectedTrade, setSelectedTrade] = useState(0)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative bg-[#fafbfa] overflow-hidden border-b border-border/40 pt-[64px]">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }} />

        <div className="relative mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8 pt-[100px] sm:pt-[120px] pb-14 sm:pb-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-10 lg:gap-16 items-start">
            <div className="max-w-[560px] lg:pt-6">
              <div className="animate-fade-up inline-flex items-center gap-2 text-[13px] font-medium text-primary bg-primary/[0.06] px-3.5 py-1.5 rounded-md mb-6">
                <MapPin size={14} />
                50,000+ professionals across the UK
              </div>

              <h1 className="animate-fade-up delay-100 text-[2.5rem] sm:text-[3.25rem] lg:text-[3.75rem] font-bold text-dark leading-[1.06] tracking-[-0.035em]">
                Earn money<br />
                <span className="text-primary">your way.</span>
              </h1>

              <p className="animate-fade-up delay-200 mt-5 text-[17px] leading-[1.65] text-muted max-w-[440px]">
                Find local jobs that match your skills and schedule. Set your own rates, choose your own customers, and grow your business with Servios.
              </p>

              <div className="animate-fade-up delay-300 mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {benefits.map(({ text, icon: Icon }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/[0.07] flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-primary" />
                    </div>
                    <span className="text-[13.5px] text-dark font-medium">{text}</span>
                  </div>
                ))}
              </div>

              <div className="animate-fade-up delay-400 mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[11, 23, 33, 45, 53].map(n => (
                    <img key={n} src={`https://i.pravatar.cc/36?img=${n}`} alt="" className="w-8 h-8 rounded-full ring-2 ring-[#fafbfa] object-cover" />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-amber-400 fill-amber-400" />)}
                    <span className="text-[13px] font-semibold text-dark ml-1">4.8</span>
                  </div>
                  <p className="text-[12px] text-muted mt-0.5">from 12,400+ provider reviews</p>
                </div>
              </div>
            </div>

            {/* Signup card */}
            <div className="animate-fade-up delay-200">
              <div className="bg-white rounded-2xl border border-border/70 shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-6 sm:p-8 lg:sticky lg:top-[88px]">
                <h2 className="text-[20px] font-bold text-dark tracking-[-0.01em] mb-1">Get started for free</h2>
                <p className="text-[14px] text-muted mb-6">Create your profile in under 2 minutes.</p>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-[12.5px] font-medium text-dark mb-1.5 block">Your trade or service</label>
                    <input type="text" placeholder="e.g. Plumber, Cleaner, Electrician" className="w-full bg-[#fafbfa] border border-border rounded-xl px-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all" />
                  </div>
                  <div>
                    <label className="text-[12.5px] font-medium text-dark mb-1.5 block">Your postcode</label>
                    <input type="text" placeholder="e.g. SW1A 1AA" className="w-full bg-[#fafbfa] border border-border rounded-xl px-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all" />
                  </div>
                  <div>
                    <label className="text-[12.5px] font-medium text-dark mb-1.5 block">Email address</label>
                    <input type="email" placeholder="you@example.com" className="w-full bg-[#fafbfa] border border-border rounded-xl px-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all" />
                  </div>

                  <Link href="/signup?role=provider" className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all mt-1">
                    Create My Profile
                    <ArrowRight size={16} />
                  </Link>
                </div>

                <p className="text-[12px] text-muted mt-4 text-center">No credit card required. Free to get started.</p>

                <div className="mt-5 pt-5 border-t border-border/50">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <div className="flex items-center gap-2 text-muted">
                      <Shield size={14} className="text-primary" />
                      <span>Verified platform</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <Clock size={14} className="text-primary" />
                      <span>2 min setup</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <Users size={14} className="text-primary" />
                      <span>50K+ pros</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-14 sm:mb-16">
            <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">How it works</p>
            <h2 className="text-[1.85rem] sm:text-[2.25rem] font-bold text-dark tracking-[-0.025em] leading-tight">From sign-up to your first job</h2>
            <p className="mt-3 text-[16px] text-muted leading-relaxed">Four steps. Most providers get their first lead within 48 hours.</p>
          </div>

          <div className="max-w-3xl mx-auto">
            {steps.map(({ title, desc, icon: Icon }, i) => (
              <div key={i} className="relative flex gap-6 sm:gap-8 pb-12 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-white shrink-0 relative z-10">
                    <Icon size={20} />
                  </div>
                  {i < steps.length - 1 && <div className="w-px flex-1 bg-border mt-3" />}
                </div>
                <div className="pt-1 pb-2">
                  <div className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">Step {i + 1}</div>
                  <h3 className="text-[17px] font-semibold text-dark mb-2">{title}</h3>
                  <p className="text-[14.5px] text-muted leading-[1.65] max-w-md">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings */}
      <section className="py-20 sm:py-24 lg:py-28 bg-[#fafbfa]">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="grid lg:grid-cols-[1fr,1.1fr] gap-12 lg:gap-20 items-center">
            <div>
              <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Earnings</p>
              <h2 className="text-[1.85rem] sm:text-[2.25rem] font-bold text-dark tracking-[-0.025em] leading-tight">
                See how much you <br className="hidden sm:block" />could earn on Servios
              </h2>
              <p className="mt-3 text-[16px] text-muted leading-relaxed max-w-md">
                Earnings vary by trade, experience, and location. These are real averages from active UK providers on our platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {earningsData.map((t, i) => (
                  <button
                    key={t.trade}
                    onClick={() => setSelectedTrade(i)}
                    className={`text-[13px] font-medium px-4 py-2 rounded-lg transition-all ${selectedTrade === i ? 'bg-primary text-white' : 'bg-white border border-border text-dark hover:border-primary/25'}`}
                  >
                    {t.trade}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-11 h-11 rounded-xl bg-primary/[0.07] flex items-center justify-center">
                  <BarChart3 size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-dark">{earningsData[selectedTrade].trade}</p>
                  <p className="text-[12.5px] text-muted">Average UK earnings on Servios</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-[11.5px] font-medium text-muted uppercase tracking-wider mb-2">Hourly rate</p>
                  <p className="text-[28px] sm:text-[32px] font-bold text-dark leading-none tracking-tight">{earningsData[selectedTrade].hourly}</p>
                </div>
                <div>
                  <p className="text-[11.5px] font-medium text-muted uppercase tracking-wider mb-2">Monthly</p>
                  <p className="text-[28px] sm:text-[32px] font-bold text-primary leading-none tracking-tight">{earningsData[selectedTrade].monthly}</p>
                </div>
                <div>
                  <p className="text-[11.5px] font-medium text-muted uppercase tracking-wider mb-2">Jobs</p>
                  <p className="text-[28px] sm:text-[32px] font-bold text-dark leading-none tracking-tight">{earningsData[selectedTrade].jobs.split('/')[0]}</p>
                  <p className="text-[12px] text-muted mt-1">per month avg</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border/50">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-[13.5px] text-muted leading-[1.6]">
                    You set your own rates. Servios charges a small platform fee per completed job — so our interests are aligned with yours. <strong className="text-dark font-medium">Transparent pricing, no surprises.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="grid lg:grid-cols-[0.4fr,1fr] gap-8 lg:gap-16 items-start">
            <div>
              <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Categories</p>
              <h2 className="text-[1.85rem] sm:text-[2.25rem] font-bold text-dark tracking-[-0.025em] leading-tight">Trades in demand right now</h2>
              <p className="mt-3 text-[15px] text-muted leading-relaxed">
                These are the most requested services on Servios. If you offer any of them, customers are already looking for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {categories.map(cat => (
                <span key={cat} className="text-[13.5px] font-medium text-dark bg-white border border-border px-4 py-2.5 rounded-lg hover:border-primary/25 hover:text-primary cursor-pointer transition-all">
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-24 lg:py-28 bg-[#fafbfa]">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12 sm:mb-14">
            <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Provider stories</p>
            <h2 className="text-[1.85rem] sm:text-[2.25rem] font-bold text-dark tracking-[-0.025em] leading-tight">Real pros. Real earnings.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border border-border/60 overflow-hidden flex flex-col">
                <div className="bg-primary/[0.03] px-6 py-4 border-b border-border/40 flex items-center justify-between">
                  <div>
                    <p className="text-[24px] font-bold text-dark tracking-tight leading-none">{t.earnings}</p>
                    <p className="text-[12px] text-muted mt-0.5">{t.period}</p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, i) => <Star key={i} size={13} className="text-amber-400 fill-amber-400" />)}
                  </div>
                </div>
                <div className="p-6 flex-1">
                  <p className="text-[14.5px] text-dark leading-[1.65]">&quot;{t.text}&quot;</p>
                </div>
                <div className="px-6 pb-6 flex items-center gap-3">
                  <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5" />
                  <div>
                    <p className="text-[14px] font-semibold text-dark">{t.name}</p>
                    <p className="text-[12.5px] text-muted">{t.trade} · {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24 lg:py-28">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="grid lg:grid-cols-[0.4fr,1fr] gap-12 lg:gap-20">
            <div>
              <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">FAQ</p>
              <h2 className="text-[1.85rem] sm:text-[2.25rem] font-bold text-dark tracking-[-0.025em] leading-tight">Common questions</h2>
              <p className="mt-3 text-[15px] text-muted leading-relaxed">
                Can&apos;t find what you&apos;re looking for?{' '}
                <a href="#" className="text-primary hover:text-primary-dark underline underline-offset-2">Get in touch</a>.
              </p>
            </div>
            <div className="border-t border-border/60">
              {faqs.map(faq => <FaqItem key={faq.q} {...faq} />)}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-24 lg:py-28 bg-[#fafbfa]">
        <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
          <div className="bg-dark rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-primary" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }} />
            <div className="relative px-6 py-16 sm:px-12 sm:py-20 lg:px-20 lg:py-24 text-center">
              <h2 className="text-[2rem] sm:text-[2.75rem] font-bold text-white tracking-[-0.03em] leading-tight max-w-2xl mx-auto">
                Ready to grow your business?
              </h2>
              <p className="mt-4 text-[17px] text-gray-400 leading-relaxed max-w-lg mx-auto">
                Join 50,000+ professionals earning more, working on their own terms, across the UK.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup?role=provider" className="inline-flex items-center justify-center gap-2 bg-white text-dark font-medium text-[15px] px-8 py-3.5 rounded-xl hover:bg-gray-100 transition-colors">
                  Sign Up as a Provider
                  <ArrowRight size={16} />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-medium text-[15px] px-8 py-3.5 rounded-xl hover:bg-white/15 transition-colors border border-white/10">
                  Contact Sales
                </button>
              </div>
              <p className="mt-5 text-[13px] text-gray-500">Free to get started. No credit card needed.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
