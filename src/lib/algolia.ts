import { algoliasearch } from 'algoliasearch'

const appId     = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID    ?? ''
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? ''

export const algoliaConfigured = Boolean(appId && searchKey)

export const searchClient = algoliaConfigured
  ? algoliasearch(appId, searchKey)
  : null

export const PROVIDERS_INDEX = 'providers'
