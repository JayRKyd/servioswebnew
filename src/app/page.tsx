import Navbar from '@/components/public/Navbar'
import Hero from '@/components/public/Hero'
import Categories from '@/components/public/Categories'
import PopularServices from '@/components/public/PopularServices'
import HowItWorks from '@/components/public/HowItWorks'
import Testimonials from '@/components/public/Testimonials'
import CTABanner from '@/components/public/CTABanner'
import Footer from '@/components/public/Footer'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Categories />
      <PopularServices />
      <HowItWorks />
      <Testimonials />
      <CTABanner />
      <Footer />
    </>
  )
}
