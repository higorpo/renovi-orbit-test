// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutApi from "../../api/checkout.api";
import { useCheckoutStepper } from "../useCheckoutStepper";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCheckoutStepper", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts on CPF when requirements report missing CPF", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: true,
        needs_phone: false,
        needs_card: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useCheckoutStepper(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRequirements).toBe(false);
    });

    expect(result.current.currentStep).toBe("cpf");
    expect(result.current.steps).toEqual([
      "cpf",
      "card",
      "installments",
      "confirmation",
    ]);
  });

  it("preserves step data across back and forward navigation", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: true,
        needs_phone: true,
        needs_card: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useCheckoutStepper(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRequirements).toBe(false);
    });

    act(() => {
      result.current.updateStepData({ cpf: "123.456.789-09" });
      result.current.goNext();
    });

    expect(result.current.currentStep).toBe("phone");

    act(() => {
      result.current.updateStepData({ phone: "(48) 99999-9999" });
      result.current.goBack();
    });

    expect(result.current.currentStep).toBe("cpf");
    expect(result.current.stepData.cpf).toBe("123.456.789-09");
    expect(result.current.stepData.phone).toBe("(48) 99999-9999");
  });

  it("generates a stable clearsaleSessionId once per stepper session", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: false,
        needs_phone: false,
        needs_card: true,
      },
      error: null,
    });

    const { result, rerender } = renderHook(() => useCheckoutStepper(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoadingRequirements).toBe(false);
    });

    const firstSessionId = result.current.ensureClearsaleSessionId();
    rerender();
    const secondSessionId = result.current.ensureClearsaleSessionId();

    expect(firstSessionId).toBe(secondSessionId);
    expect(result.current.clearsaleSessionId).toBe(firstSessionId);
  });
});
