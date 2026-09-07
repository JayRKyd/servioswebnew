import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.WEB_URL ?? 'https://servioswebnew.vercel.app').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  // Public marketing surface only — provider profiles join this list once
  // logged-out browsing ships
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/join-provider`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
