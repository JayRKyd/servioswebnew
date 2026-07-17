import { algoliasearch } from 'algoliasearch'

// trim() guards against stray whitespace in env values (a pasted tab in the
// app ID once produced a 403 "Invalid Application-ID" in production)
const appId     = (process.env.NEXT_PUBLIC_ALGOLIA_APP_ID    ?? '').trim()
const searchKey = (process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? '').trim()

export const algoliaConfigured = Boolean(appId && searchKey)

export const searchClient = algoliaConfigured
  ? algoliasearch(appId, searchKey)
  : null

export const PROVIDERS_INDEX = 'providers'
