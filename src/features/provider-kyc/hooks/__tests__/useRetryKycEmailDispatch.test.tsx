// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kycApi from "../../api/kyc.api";
import { useRetryKycEmailDispatch } from "../useRetryKycEmailDispatch";

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useRetryKycEmailDispatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when disabled", () => {
    const spy = vi.spyOn(kycApi, "retryProviderKycEmailDispatch");
    renderHook(() => useRetryKycEmailDispatch(false), {
      wrapper: createWrapper().wrapper,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("retries immediately and on interval, invalidating when email is dispatched", async () => {
    const retrySpy = vi.spyOn(kycApi, "retryProviderKycEmailDispatch").mockResolvedValue({
      data: {
        submissionId: "sub-1",
        emailDispatched: true,
      },
      error: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useRetryKycEmailDispatch(true), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(retrySpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await Promise.resolve();
    });

    expect(invalidateSpy).toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
    });

    expect(retrySpy).toHaveBeenCalledTimes(2);
  });

  it("skips overlapping retries while a previous dispatch is still pending", async () => {
    let resolveRetry: (value: {
      data: { submissionId: string; emailDispatched: boolean };
      error: null;
    }) => void = () => {};

    const retrySpy = vi.spyOn(kycApi, "retryProviderKycEmailDispatch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
    );

    renderHook(() => useRetryKycEmailDispatch(true), {
      wrapper: createWrapper().wrapper,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(retrySpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(retrySpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRetry({
        data: { submissionId: "sub-1", emailDispatched: false },
        error: null,
      });
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
    });

    expect(retrySpy).toHaveBeenCalledTimes(2);
  });
});
