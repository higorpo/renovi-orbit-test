// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useClientCardManualPayment } from "../useClientCardManualPayment";

const toastError = vi.fn();
const usePaymentScheduleMock = vi.fn();

vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("@/features/payments", () => ({
  PAYMENT_SCHEDULE_QUERY_KEY: ["payment-schedule"],
  usePaymentSchedule: (...args: unknown[]) => usePaymentScheduleMock(...args),
}));

vi.mock("@/features/view-services", () => ({
  SERVICES_LIST_QUERY_KEY: ["view-services", "list"],
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useClientCardManualPayment", () => {
  beforeEach(() => {
    toastError.mockReset();
    usePaymentScheduleMock.mockReset();
    usePaymentScheduleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("does not open when contractedServiceId is missing", () => {
    const { result } = renderHook(() => useClientCardManualPayment(null), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.open).toBe(false);
    expect(toastError).toHaveBeenCalled();
  });

  it("opens and enables schedule fetch for a contracted service", () => {
    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.open).toBe(true);
    expect(usePaymentScheduleMock).toHaveBeenCalledWith("cs-1", true);
  });
});
