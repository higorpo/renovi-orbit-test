export { createIDBPersister } from './persister'

/** Max age for persisted cache (24h). Must be <= QueryClient defaultOptions.queries.gcTime. */
export const PERSISTED_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24
