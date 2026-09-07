import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.WEB_URL ?? 'https://servioswebnew.vercel.app').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Authenticated and API surfaces have no business in search results
      disallow: ['/api/', '/dashboard', '/provider', '/landlord', '/tenant', '/admin', '/messages', '/settings', '/bookings', '/auth/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
