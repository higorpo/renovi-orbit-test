// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useRepublishCancelledService } from "../useRepublishCancelledService";

const {
  navigateMock,
  republishMock,
  trackEventMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  republishMock: vi.fn(),
  trackEventMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: trackEventMock }),
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000099",
}));

vi.mock("../../api/services.api", () => ({
  republishCancelledServiceRequest: republishMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRepublishCancelledService", () => {
  it("navigates to the new service detail on success", async () => {
    republishMock.mockResolvedValue({
      data: { requestId: "sr-new", sourceRequestId: "sr-old" },
      error: null,
    });

    const { result } = renderHook(() => useRepublishCancelledService(), {
      wrapper: createWrapper(),
    });

    result.current.republishCancelledService("sr-old");

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/services/sr-new");
    });
    expect(republishMock).toHaveBeenCalledWith(
      "sr-old",
      "00000000-0000-7000-8000-000000000099",
    );
    expect(trackEventMock).toHaveBeenCalledWith("cancelled_service_republished", {
      source_service_request_id: "sr-old",
      new_service_request_id: "sr-new",
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("shows an error toast when republish fails", async () => {
    republishMock.mockResolvedValue({
      data: null,
      error: "SR_NOT_CANCELLED",
    });

    const { result } = renderHook(() => useRepublishCancelledService(), {
      wrapper: createWrapper(),
    });

    result.current.republishCancelledService("sr-open");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("throws fallback message when republish returns empty data", async () => {
    republishMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useRepublishCancelledService(), {
      wrapper: createWrapper(),
    });

    result.current.republishCancelledService("sr-open");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });
});
