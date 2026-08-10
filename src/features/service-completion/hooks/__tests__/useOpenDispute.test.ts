// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISPUTE_OPENED_ANALYTICS_EVENT,
  DISPUTE_OPEN_FAILED_ANALYTICS_EVENT,
  useOpenDispute,
} from "../useOpenDispute";

const openDispute = vi.fn();
const trackEvent = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("../../api/lifecycle.api", () => ({
  openDispute: (...args: unknown[]) => openDispute(...args),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useOpenDispute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens dispute, tracks success, invalidates queries, and calls onOpened", async () => {
    openDispute.mockResolvedValue({
      data: {
        contractedServiceId: "cs-1",
        status: "IN_DISPUTE",
        disputedAt: "2026-08-10T12:00:00Z",
        disputedBy: "client-1",
        disputeReason: "Problema",
        chatId: "chat-1",
      },
      error: null,
    });
    const onOpened = vi.fn();

    const { result } = renderHook(
      () =>
        useOpenDispute({
          serviceRequestId: "sr-1",
          contractedServiceId: "cs-1",
          onOpened,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ reason: "Problema" });
    });

    expect(openDispute).toHaveBeenCalledWith({
      contractedServiceId: "cs-1",
      reason: "Problema",
    });
    expect(trackEvent).toHaveBeenCalledWith(DISPUTE_OPENED_ANALYTICS_EVENT, {
      contracted_service_id: "cs-1",
      has_reason: true,
    });
    expect(toastSuccess).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(onOpened).toHaveBeenCalledWith(
      expect.objectContaining({ status: "IN_DISPUTE" }),
    );
  });

  it("tracks failure and surfaces toast on API error", async () => {
    openDispute.mockResolvedValue({
      data: null,
      error: "Já existe uma disputa aberta para este serviço.",
      errorCode: "DISPUTE_OPEN",
    });

    const { result } = renderHook(
      () =>
        useOpenDispute({
          serviceRequestId: "sr-1",
          contractedServiceId: "cs-1",
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({ reason: null }),
      ).rejects.toThrow(/disputa/i);
    });

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith(
        DISPUTE_OPEN_FAILED_ANALYTICS_EVENT,
        expect.objectContaining({ contracted_service_id: "cs-1" }),
      );
    });
    expect(toastError).toHaveBeenCalled();
  });
});
