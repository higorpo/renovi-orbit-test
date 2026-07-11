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

  it("closes via handleOpenChange", () => {
    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.openModal();
    });
    act(() => {
      result.current.handleOpenChange(false);
    });

    expect(result.current.open).toBe(false);
  });

  it("exposes schedule/context and loading only while open", () => {
    usePaymentScheduleMock.mockReturnValue({
      data: {
        schedule: { id: "sch-1" },
        context: { amount: 10 },
      },
      isLoading: true,
      isError: false,
      error: new Error("x"),
      refetch: vi.fn(),
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useClientCardManualPayment(id),
      { wrapper, initialProps: { id: "cs-1" } },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.openModal();
    });
    rerender({ id: "cs-1" });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.schedule).toEqual({ id: "sch-1" });
    expect(result.current.context).toEqual({ amount: 10 });
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("closes and toasts when schedule query errors while open", () => {
    usePaymentScheduleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useClientCardManualPayment("cs-1"), {
      wrapper,
    });

    act(() => {
      result.current.openModal();
    });

    usePaymentScheduleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("fail"),
      refetch: vi.fn(),
    });
    rerender();

    expect(toastError).toHaveBeenCalled();
    expect(result.current.open).toBe(false);
  });

  it("invalidates queries on handleCompleted", () => {
    const refetch = vi.fn();
    usePaymentScheduleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.handleCompleted();
    });

    expect(refetch).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});

describe("useClientCardManualPayment additional branches", () => {
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

  it("does not toast for a query error before the modal opens", () => {
    usePaymentScheduleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("fail"),
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    expect(result.current.open).toBe(false);
    expect(result.current.error).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("exposes null schedule and context when opened without query data", () => {
    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.schedule).toBeNull();
    expect(result.current.context).toBeNull();
  });

  it("opens via handleOpenChange", () => {
    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.handleOpenChange(true);
    });

    expect(result.current.open).toBe(true);
    expect(usePaymentScheduleMock).toHaveBeenCalledWith("cs-1", true);
  });

  it("exposes null context when schedule exists but context is missing", () => {
    usePaymentScheduleMock.mockReturnValue({
      data: { schedule: { id: "sched-1" }, context: undefined },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useClientCardManualPayment("cs-1"), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.schedule).toEqual({ id: "sched-1" });
    expect(result.current.context).toBeNull();
  });
});
