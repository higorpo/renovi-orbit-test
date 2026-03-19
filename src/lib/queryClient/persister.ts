import { get, set, del, createStore } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const REACT_QUERY_DB = 'orbit-vault'
const REACT_QUERY_STORE = 'query-cache'
const REACT_QUERY_CACHE_KEY = 'persisted-cache'

const idbStore = createStore(REACT_QUERY_DB, REACT_QUERY_STORE)

/**
 * IndexedDB persister for React Query cache.
 * Enables offline-first: cache survives reloads and works without network.
 * Prefer IndexedDB over localStorage for larger storage and async API.
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(REACT_QUERY_CACHE_KEY, client, idbStore)
    },
    restoreClient: async () => {
      return await get<PersistedClient>(REACT_QUERY_CACHE_KEY, idbStore)
    },
    removeClient: async () => {
      await del(REACT_QUERY_CACHE_KEY, idbStore)
    },
  }
}
