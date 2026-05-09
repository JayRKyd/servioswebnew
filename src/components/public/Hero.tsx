import { Search, ArrowRight, Shield, Star, Users } from 'lucide-react'

const services = ['a cleaner', 'a plumber', 'an electrician', 'a painter', 'a gardener']

export default function Hero() {
  return (
    <section className="relative bg-[#fafbfa] overflow-hidden">
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] left-[-80px] w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)`,
        backgroundSize: '80px 80px'
      }} />

      <div className="relative mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8 pt-[120px] sm:pt-[140px] pb-16 sm:pb-20 lg:pb-0">
        <div className="grid lg:grid-cols-[1fr,0.85fr] gap-12 lg:gap-16 items-end">
          <div className="max-w-[600px] lg:pb-20">
            <div className="animate-fade-up inline-flex items-center gap-2.5 bg-primary/[0.06] border border-primary/[0.08] rounded-full pl-1.5 pr-4 py-1.5 mb-8">
              <span className="inline-flex items-center gap-1 bg-primary text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full">New</span>
              <span className="text-[13px] text-muted font-medium">Now in 200+ UK cities</span>
            </div>

            <h1 className="animate-fade-up delay-100">
              <span className="block text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem] font-bold text-dark leading-[1.05] tracking-[-0.035em]">Find</span>
              <span className="block text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem] font-bold leading-[1.05] tracking-[-0.035em]">
                <span className="inline-flex h-[1.1em] overflow-hidden align-bottom">
                  <span className="word-rotator flex flex-col">
                    {services.map((word) => (
                      <span key={word} className="text-primary h-[1.1em] flex items-center">{word}</span>
                    ))}
                  </span>
                </span>
              </span>
              <span className="block text-[3rem] sm:text-[3.75rem] lg:text-[4.25rem] font-bold text-dark leading-[1.05] tracking-[-0.035em]">you can trust.</span>
            </h1>

            <p className="animate-fade-up delay-200 mt-6 text-[17px] sm:text-[18px] leading-[1.65] text-muted max-w-[440px]">
              Describe your job. Get free quotes from vetted local pros. Hire with confidence.
            </p>

            <div className="animate-fade-up delay-300 mt-9">
              <div className="relative flex items-center bg-white border border-border rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-within:border-primary/30 focus-within:shadow-[0_2px_16px_rgba(17,94,86,0.08)] transition-all">
                <Search size={20} className="ml-3 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="What do you need help with?"
                  className="flex-1 bg-transparent text-[15px] text-dark placeholder:text-gray-400 px-3 py-2.5 outline-none"
                />
                <button className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-[14px] pl-5 pr-4 py-2.5 rounded-xl transition-all shrink-0">
                  Get Quotes
                  <ArrowRight size={15} />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted/60">Popular:</span>
                {['End of tenancy clean', 'Boiler repair', 'Flat-pack assembly', 'Garden tidy'].map(tag => (
                  <button key={tag} className="text-[12px] text-muted hover:text-dark bg-white hover:bg-gray-50 border border-border px-3 py-1 rounded-lg transition-all">
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="animate-fade-up delay-400 mt-10 flex flex-wrap items-center gap-6 sm:gap-8">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 border border-amber-100/80">
                  <Star size={16} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-dark leading-none">4.8/5</p>
                  <p className="text-[11.5px] text-muted mt-0.5">12K+ reviews</p>
                </div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/[0.06] border border-primary/10">
                  <Users size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-dark leading-none">50K+</p>
                  <p className="text-[11.5px] text-muted mt-0.5">verified pros</p>
                </div>
              </div>
              <div className="w-px h-8 bg-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100/80">
                  <Shield size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-dark leading-none">Guaranteed</p>
                  <p className="text-[11.5px] text-muted mt-0.5">satisfaction pledge</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block relative">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1 row-span-2 float-slow">
                <div className="rounded-2xl overflow-hidden h-[420px] shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04]">
                  <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=600&fit=crop&crop=center" alt="Professional cleaner" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="float-slower">
                <div className="rounded-2xl overflow-hidden h-[200px] shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04]">
                  <img src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop" alt="Electrician at work" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="float-slow" style={{ animationDelay: '2s' }}>
                <div className="rounded-2xl overflow-hidden h-[200px] shadow-[0_8px_40px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04]">
                  <img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop" alt="Garden maintenance" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <div className="absolute -left-8 bottom-16 float-slower z-10">
              <div className="bg-white rounded-xl p-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03] max-w-[210px]">
                <div className="flex items-center gap-2 mb-2">
                  <img src="https://i.pravatar.cc/32?img=47" alt="" className="w-7 h-7 rounded-full ring-1 ring-black/5" />
                  <div>
                    <p className="text-[12px] font-semibold text-dark leading-tight">Sarah T.</p>
                    <div className="flex gap-px mt-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400" />)}
                    </div>
                  </div>
                </div>
                <p className="text-[11.5px] text-muted leading-[1.5]">&quot;Absolutely brilliant. Kitchen deep clean done in 90 mins flat.&quot;</p>
              </div>
            </div>

            <div className="absolute -right-2 top-8 float-slow z-10" style={{ animationDelay: '3s' }}>
              <div className="bg-white rounded-lg px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[12px] font-semibold text-dark">247 jobs posted today</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-up delay-500 border-t border-border/60 mt-12 lg:mt-0 py-8 lg:py-10">
          <p className="text-[11.5px] text-muted/50 uppercase tracking-widest font-medium mb-5">Trusted by teams at</p>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            {['Rightmove', 'Zoopla', 'OpenRent', 'Purplebricks', 'Foxtons'].map((name) => (
              <span key={name} className="text-[15px] font-semibold text-dark/[0.12] tracking-[-0.01em] select-none">{name}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
