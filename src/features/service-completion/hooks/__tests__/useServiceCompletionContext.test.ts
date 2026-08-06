// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServiceCompletionContext } from "../useServiceCompletionContext";

const getServiceCompletionContext = vi.fn();

vi.mock("../../api/context.api", () => ({
  getServiceCompletionContext: (...args: unknown[]) =>
    getServiceCompletionContext(...args),
}));

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useServiceCompletionContext", () => {
  beforeEach(() => {
    getServiceCompletionContext.mockReset();
  });

  it("loads completion context while enrichment is PENDING", async () => {
    getServiceCompletionContext.mockResolvedValue({
      data: {
        enrichment: { status: "PENDING" },
        contractedService: null,
      },
      error: null,
    });

    const { result } = renderHook(
      () =>
        useServiceCompletionContext("sr-1", {
          pollWhileProcessing: true,
          requestStatus: "OPEN",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.enrichment?.status).toBe("PENDING");
  });

  it("loads completion context when enrichment is READY", async () => {
    getServiceCompletionContext.mockResolvedValue({
      data: {
        enrichment: { status: "READY" },
        contractedService: null,
      },
      error: null,
    });

    const { result } = renderHook(
      () => useServiceCompletionContext("sr-1"),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.enrichment?.status).toBe("READY");
  });

  it("still loads context when request is CANCELLED during enrichment", async () => {
    getServiceCompletionContext.mockResolvedValue({
      data: {
        enrichment: { status: "RUNNING" },
        contractedService: null,
      },
      error: null,
    });

    const { result } = renderHook(
      () =>
        useServiceCompletionContext("sr-1", {
          requestStatus: "CANCELLED",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.enrichment?.status).toBe("RUNNING");
  });
});
