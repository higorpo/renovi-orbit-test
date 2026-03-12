import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import {
  createTestQueryClient,
  type RequestQuoteWrapperOptions,
} from "./fixtures/requestQuoteTestFixtures";

export type { RequestQuoteWrapperOptions };

/**
 * Wraps children with QueryClientProvider and MemoryRouter.
 * Use for components that need useSearchParams, Link, or useQuery.
 */
export function RequestQuoteTestWrapper({
  children,
  initialEntries = ["/solicitar-orcamento"],
  queryClient = createTestQueryClient(),
}: {
  children: React.ReactNode;
  initialEntries?: string[];
  queryClient?: ReturnType<typeof createTestQueryClient>;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Renders a component with RequestQuote providers (QueryClient + MemoryRouter).
 * Use when testing components that depend on router or React Query.
 */
export function renderWithRequestQuoteProviders(
  ui: ReactElement,
  options: RenderOptions & RequestQuoteWrapperOptions = {}
) {
  const {
    initialEntries = ["/solicitar-orcamento"],
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <RequestQuoteTestWrapper initialEntries={initialEntries} queryClient={queryClient}>
        {children}
      </RequestQuoteTestWrapper>
    ),
    ...renderOptions,
  });
}
