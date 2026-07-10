// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cardsApi from "../../api/cards.api";
import { useSavedPaymentTokens } from "../useSavedPaymentTokens";

const mockUseAuth = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSavedPaymentTokens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "client-1" } });
  });

  it("loads active payment tokens", async () => {
    vi.spyOn(cardsApi, "listActivePaymentTokens").mockResolvedValue({
      data: [{
        id: "token-1",
        card_number_masked: "****1111",
        card_brand: "VISA",
        expiry_month: 10,
        expiry_year: 2030,
        state: "ACTIVE",
      }],
      error: null,
    });

    const { result } = renderHook(() => useSavedPaymentTokens(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(1);
  });

  it("throws when API returns an error", async () => {
    vi.spyOn(cardsApi, "listActivePaymentTokens").mockResolvedValue({
      data: null,
      error: "tokens failed",
    });

    const { result } = renderHook(() => useSavedPaymentTokens(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("tokens failed");
  });

  it("does not fetch when disabled", () => {
    const spy = vi.spyOn(cardsApi, "listActivePaymentTokens");
    renderHook(() => useSavedPaymentTokens(false), { wrapper: createWrapper() });
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not fetch when the user session is missing", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const spy = vi.spyOn(cardsApi, "listActivePaymentTokens");
    renderHook(() => useSavedPaymentTokens(), { wrapper: createWrapper() });
    expect(spy).not.toHaveBeenCalled();
  });
});
