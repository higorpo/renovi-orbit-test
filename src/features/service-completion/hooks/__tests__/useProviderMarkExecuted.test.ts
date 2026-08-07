// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderMarkExecuted } from "../useProviderMarkExecuted";

const markServiceExecuted = vi.fn();

vi.mock("../../api/lifecycle.api", () => ({
  markServiceExecuted: (...args: unknown[]) => markServiceExecuted(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useProviderMarkExecuted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses a stable idempotency key across getIdempotencyKey calls", () => {
    const { result } = renderHook(() => useProviderMarkExecuted(), {
      wrapper: wrapper(),
    });
    const a = result.current.getIdempotencyKey();
    const b = result.current.getIdempotencyKey();
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("passes idempotency key into markServiceExecuted", async () => {
    markServiceExecuted.mockResolvedValue({
      data: {
        contractedServiceId: "cs-1",
        status: "EXECUTED",
        executedAt: "2026-08-04T12:00:00Z",
        evidenceId: "ev-1",
        idempotent: false,
      },
      error: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useProviderMarkExecuted(), {
      wrapper: Wrapper,
    });
    const key = result.current.getIdempotencyKey();

    await result.current.mutateAsync({
      serviceRequestId: "sr-1",
      contractedServiceId: "cs-1",
      responses: { c1: { met: true, evidence_paths: [] } },
      expectedDraftVersion: 2,
    });

    expect(markServiceExecuted).toHaveBeenCalledWith(
      expect.objectContaining({
        contractedServiceId: "cs-1",
        idempotencyKey: key,
        expectedDraftVersion: 2,
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["view-services", "list"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["view-services", "detail"],
    });
  });

  it("surfaces CHECKLIST_PAYLOAD_REQUIRED from API", async () => {
    markServiceExecuted.mockResolvedValue({
      data: null,
      error: "Preencha o checklist de conclusão antes de marcar como executado.",
      errorCode: "CHECKLIST_PAYLOAD_REQUIRED",
    });

    const { result } = renderHook(() => useProviderMarkExecuted(), {
      wrapper: wrapper(),
    });

    await expect(
      result.current.mutateAsync({
        serviceRequestId: "sr-1",
        contractedServiceId: "cs-1",
        responses: {},
      }),
    ).rejects.toMatchObject({
      errorCode: "CHECKLIST_PAYLOAD_REQUIRED",
    });
  });
});
