import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClient, QueryCache, MutationCache, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { initCapacitorPlugins } from '@/lib/capacitor'
import { initSentry, captureException } from '@/lib/sentry'
import { createIDBPersister, PERSISTED_CACHE_MAX_AGE_MS } from '@/lib/queryClient'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import '@fontsource-variable/inter/index.css'
import './index.css'
import { router } from './router'

initSentry()
void initCapacitorPlugins()

const queryCache = new QueryCache({
  onError: (error, query) => {
    captureException(error, {
      context: 'react_query',
      queryKey: JSON.stringify(query.queryKey),
    })
  },
})

const mutationCache = new MutationCache({
  onError: (error) => {
    captureException(error, { context: 'react_query_mutation' })
  },
})

const disableReactQueryCache = import.meta.env.VITE_DISABLE_REACT_QUERY_CACHE === 'true'

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: disableReactQueryCache ? 0 : 60 * 1000,
      refetchOnMount: disableReactQueryCache ? 'always' : true,
      refetchOnWindowFocus: disableReactQueryCache ? true : false,
      refetchOnReconnect: disableReactQueryCache,
      // When cache is disabled, clear inactive queries immediately.
      // Otherwise, keep cache at least as long as persisted data so hydration is not discarded by GC.
      gcTime: disableReactQueryCache ? 0 : PERSISTED_CACHE_MAX_AGE_MS,
    },
  },
})

const persister = createIDBPersister()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {disableReactQueryCache ? (
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
        </QueryClientProvider>
      ) : (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister, maxAge: PERSISTED_CACHE_MAX_AGE_MS }}
        >
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
        </PersistQueryClientProvider>
      )}
    </ErrorBoundary>
  </StrictMode>
)
