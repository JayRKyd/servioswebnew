import type { Metadata } from 'next'
import "@/styles/tailwind.css"
import "@/app/globals.css"
import { AuthProvider } from '@/components/providers/AuthProvider'
import { RoleProvider } from '@/components/providers/RoleProvider'

const SITE_URL = (process.env.WEB_URL ?? 'https://servioswebnew.vercel.app').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Servios — Find trusted local professionals',
    template: '%s — Servios',
  },
  description: 'Compare vetted local trade professionals across London, get free quotes, and book with a 90-day workmanship guarantee. Free for customers.',
  openGraph: {
    siteName: 'Servios',
    type: 'website',
    title: 'Servios — Find trusted local professionals',
    description: 'Compare vetted local trade professionals, get free quotes, and book with a 90-day workmanship guarantee.',
    images: [{ url: '/brand/servios-mark.png', width: 330, height: 318, alt: 'Servios' }],
  },
  twitter: {
    card: 'summary',
    title: 'Servios — Find trusted local professionals',
    description: 'Compare vetted local trade professionals, get free quotes, and book with a 90-day workmanship guarantee.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RoleProvider>
            {children}
          </RoleProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
