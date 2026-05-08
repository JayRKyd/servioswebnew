'use client'
import { useState, useEffect } from 'react'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'nav-scrolled' : 'bg-white/0'}`}>
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="flex h-[64px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 bg-primary rounded-lg" />
              <svg className="relative" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M10 20.5c0-2.5 3-4.5 6-4.5s6 2 6 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="12" r="3.5" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-[18px] font-semibold text-dark tracking-[-0.03em]">Servios</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1 bg-dark/[0.04] rounded-full px-1.5 py-1">
            <a href="#categories" className="text-[13px] font-medium text-muted hover:text-dark px-4 py-1.5 rounded-full hover:bg-white/80 transition-all">Services</a>
            <a href="#how-it-works" className="text-[13px] font-medium text-muted hover:text-dark px-4 py-1.5 rounded-full hover:bg-white/80 transition-all">How It Works</a>
            <a href="#" className="text-[13px] font-medium text-muted hover:text-dark px-4 py-1.5 rounded-full hover:bg-white/80 transition-all">Pricing</a>
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/join-provider" className="group/link inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-dark transition-colors">
              Join as a Provider
              <ArrowUpRight size={13} className="opacity-60 group-hover/link:opacity-100 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-all" />
            </Link>
            <div className="w-px h-4 bg-border mx-1" />
            <Link href="/login" className="text-[13px] font-medium text-muted hover:text-dark px-3 py-1.5 transition-colors">Log In</Link>
            <Link href="/signup" className="text-[13px] font-medium text-white bg-dark hover:bg-dark/85 px-4 py-2 rounded-full transition-all">
              Get Started
            </Link>
          </div>

          <button className="lg:hidden p-2 -mr-2 text-dark" onClick={() => setOpen(!open)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-border/60 px-5 pb-6 pt-4">
          <a href="#categories" className="block py-3 text-[15px] font-medium text-dark border-b border-border/40">Services</a>
          <a href="#how-it-works" className="block py-3 text-[15px] font-medium text-dark border-b border-border/40">How It Works</a>
          <a href="#" className="block py-3 text-[15px] font-medium text-dark border-b border-border/40">Pricing</a>
          <div className="mt-5 space-y-3">
            <Link href="/join-provider" className="block w-full text-center py-3 text-[14px] font-medium text-primary border border-primary/20 rounded-xl">Join as a Provider</Link>
            <div className="flex gap-3">
              <Link href="/login" className="flex-1 text-center py-3 text-[14px] font-medium text-muted rounded-xl">Log In</Link>
              <Link href="/signup" className="flex-1 text-center py-3 text-[14px] font-medium text-white bg-dark rounded-xl">Get Started</Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
