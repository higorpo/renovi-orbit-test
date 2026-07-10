// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useDismissOpportunity } from "../useDismissOpportunity";
import { PROVIDER_JOBS_LIST_QUERY_KEY } from "../../constants/queryKeys";
import type { ProviderJobsResponse } from "../../types/provider-jobs.types";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const mocks = vi.hoisted(() => ({
  dismissProviderOpportunity: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("../../api/dismissOpportunity.api", () => ({
  dismissProviderOpportunity: (...args: unknown[]) =>
    mocks.dismissProviderOpportunity(...args),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: mocks.trackEvent }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function makeInfiniteData(
  items: ReturnType<typeof createMinimalJob>[],
): { pages: ProviderJobsResponse[]; pageParams: (string | null)[] } {
  return {
    pages: [
      {
        items,
        next_cursor: null,
        has_more: false,
      },
    ],
    pageParams: [null],
  };
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useDismissOpportunity", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mocks.dismissProviderOpportunity.mockResolvedValue({
      data: { success: true },
      error: null,
    });
  });

  it("optimistically removes the job from cached list pages", async () => {
    const keep = createMinimalJob({ service_request_id: "keep-1" });
    const remove = createMinimalJob({ service_request_id: "remove-1" });
    const queryKey = [PROVIDER_JOBS_LIST_QUERY_KEY, "newest", null, null];
    queryClient.setQueryData(queryKey, makeInfiniteData([keep, remove]));

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("remove-1");
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData(queryKey) as ReturnType<
        typeof makeInfiniteData
      >;
      expect(cached.pages[0].items.map((j) => j.service_request_id)).toEqual([
        "keep-1",
      ]);
    });
  });

  it("tracks analytics and invalidates list queries on success", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const queryKey = [PROVIDER_JOBS_LIST_QUERY_KEY, "newest", null, null];
    queryClient.setQueryData(
      queryKey,
      makeInfiniteData([createMinimalJob({ service_request_id: "job-9" })]),
    );

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("job-9");
    });

    await waitFor(() => {
      expect(mocks.trackEvent).toHaveBeenCalledWith("provider_opportunity_dismissed", {
        service_request_id: "job-9",
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [PROVIDER_JOBS_LIST_QUERY_KEY],
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rolls back cache and shows toast when dismiss API fails", async () => {
    mocks.dismissProviderOpportunity.mockResolvedValue({
      data: null,
      error: "rpc failed",
    });

    const job = createMinimalJob({ service_request_id: "job-fail" });
    const queryKey = [PROVIDER_JOBS_LIST_QUERY_KEY, "newest", null, null];
    const previous = makeInfiniteData([job]);
    queryClient.setQueryData(queryKey, previous);

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("job-fail");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível ocultar esta oportunidade. Tente novamente.",
      );
    });

    const restored = queryClient.getQueryData(queryKey) as ReturnType<
      typeof makeInfiniteData
    >;
    expect(restored.pages[0].items).toHaveLength(1);
    expect(restored.pages[0].items[0].service_request_id).toBe("job-fail");
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it("exposes dismissingId while mutation is pending", async () => {
    let resolveDismiss: (value: {
      data: { success: boolean } | null;
      error: string | null;
    }) => void = () => {};
    mocks.dismissProviderOpportunity.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDismiss = resolve;
        }),
    );

    const queryKey = [PROVIDER_JOBS_LIST_QUERY_KEY, "newest", null, null];
    queryClient.setQueryData(
      queryKey,
      makeInfiniteData([createMinimalJob({ service_request_id: "pending-1" })]),
    );

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("pending-1");
    });

    await waitFor(() => {
      expect(result.current.isDismissing).toBe(true);
      expect(result.current.dismissingId).toBe("pending-1");
    });

    await act(async () => {
      resolveDismiss({ data: { success: true }, error: null });
    });

    await waitFor(() => {
      expect(result.current.isDismissing).toBe(false);
      expect(result.current.dismissingId).toBeNull();
    });
  });

  it("leaves undefined cache entries untouched during optimistic update", async () => {
    const queryKey = [PROVIDER_JOBS_LIST_QUERY_KEY, "newest", null, null];
    // No seed data — setQueriesData receives undefined for this key path via updater only
    queryClient.setQueryData(queryKey, undefined);

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("ghost");
    });

    await waitFor(() => {
      expect(mocks.dismissProviderOpportunity).toHaveBeenCalledWith("ghost");
    });

    expect(queryClient.getQueryData(queryKey)).toBeUndefined();
  });

  it("shows error toast even when mutation context is missing", async () => {
    mocks.dismissProviderOpportunity.mockResolvedValue({
      data: null,
      error: "rpc failed",
    });
    vi.spyOn(queryClient, "cancelQueries").mockRejectedValueOnce(
      new Error("cancel failed"),
    );

    const { result } = renderHook(() => useDismissOpportunity(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.dismissOpportunity("job-no-context");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível ocultar esta oportunidade. Tente novamente.",
      );
    });
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });
});
