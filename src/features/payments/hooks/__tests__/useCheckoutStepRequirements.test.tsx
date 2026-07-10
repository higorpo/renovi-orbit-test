// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as checkoutApi from "../../api/checkout.api";
import { useCheckoutStepRequirements } from "../useCheckoutStepRequirements";

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

describe("useCheckoutStepRequirements", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fetched requirements on success", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: {
        needs_cpf: false,
        needs_phone: true,
        needs_card: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useCheckoutStepRequirements(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.requirements).toEqual({
      needs_cpf: false,
      needs_phone: true,
      needs_card: false,
    });
    expect(result.current.isError).toBe(false);
  });

  it("keeps conservative defaults while loading", () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockReturnValue(
      new Promise(() => undefined),
    );

    const { result } = renderHook(() => useCheckoutStepRequirements(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.requirements).toEqual({
      needs_cpf: true,
      needs_phone: true,
      needs_card: true,
    });
    expect(result.current.data).toBeNull();
  });

  it("surfaces API errors and does not fetch when disabled", async () => {
    const spy = vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: null,
      error: "Falha ao carregar etapas",
    });

    const { result: disabled } = renderHook(
      () => useCheckoutStepRequirements({ enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(spy).not.toHaveBeenCalled();
    expect(disabled.current.isLoading).toBe(false);

    const { result } = renderHook(() => useCheckoutStepRequirements(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe("Falha ao carregar etapas");
  });

  it("throws fallback when response has neither data nor error", async () => {
    vi.spyOn(checkoutApi, "getCheckoutStepRequirements").mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useCheckoutStepRequirements(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe("checkout_step_requirements_unavailable");
  });
});
