import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as revokeApi from "../../api/cards.api";
import * as paymentTokensApi from "../../api/cards.api";
import { useSavedCards } from "../useSavedCards";

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

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { id: "client-1" } }),
}));

describe("useSavedCards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(paymentTokensApi, "listActivePaymentTokens").mockResolvedValue({
      data: [
        {
          id: "token-linked",
          card_number_masked: "411111XXXXXX1111",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
        {
          id: "token-free",
          card_number_masked: "555555XXXXXX4444",
          card_brand: "MASTER",
          expiry_month: 6,
          expiry_year: 2029,
          state: "ACTIVE",
        },
      ],
      error: null,
    });
  });

  it("blocks removal when the card is linked to a scheduled payment", async () => {
    vi.spyOn(revokeApi, "revokePaymentToken").mockResolvedValue({
      data: {
        outcome: "blocked",
        schedules: [
          {
            scheduleId: "schedule-1",
            contractedServiceId: "service-1",
            state: "SCHEDULED",
          },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useSavedCards(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.cards).toHaveLength(2);
    });

    let outcome: Awaited<ReturnType<typeof result.current.revokeCard>> | undefined;
    await act(async () => {
      outcome = await result.current.revokeCard("token-linked");
    });

    expect(outcome?.outcome).toBe("blocked");
    expect(result.current.cards).toHaveLength(2);
  });

  it("removes an unlinked card after revoke succeeds", async () => {
    vi.spyOn(revokeApi, "revokePaymentToken").mockResolvedValue({
      data: {
        outcome: "revoked",
        paymentTokenId: "token-free",
      },
      error: null,
    });

    const listSpy = vi.spyOn(paymentTokensApi, "listActivePaymentTokens");

    const { result } = renderHook(() => useSavedCards(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.cards).toHaveLength(2);
    });

    await act(async () => {
      await result.current.revokeCard("token-free");
    });

    await waitFor(() => {
      expect(listSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("throws when revoke API returns an error", async () => {
    vi.spyOn(revokeApi, "revokePaymentToken").mockResolvedValue({
      data: null,
      error: "revoke failed",
    });

    const { result } = renderHook(() => useSavedCards(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.cards).toHaveLength(2);
    });

    await expect(
      act(async () => {
        await result.current.revokeCard("token-free");
      }),
    ).rejects.toThrow("revoke failed");
  });
});
