import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { initSentry, captureException } from '@/lib/sentry'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import { router } from './router'

initSentry()

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

const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

const RootFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    Carregando…
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<RootFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)
