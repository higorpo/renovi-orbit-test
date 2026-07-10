// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cardsApi from "../../api/cards.api";
import {
  useInstallmentOptions,
  useInstallmentSignatureRecovery,
} from "../useInstallmentOptions";

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

describe("useInstallmentOptions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads installment options", async () => {
    vi.spyOn(cardsApi, "fetchInstallmentOptions").mockResolvedValue({
      data: {
        installment_options: [{
          installment_number: 1,
          applicable_rate_pct: 0,
          total_with_fees: 100,
          installment_amount: 100,
        }],
        installment_selection_hmac: "hmac",
        installment_hmac_payload: {
          proposal_id: "p-1",
          service_id: "s-1",
          base_amount: 100,
          card_brand: "VISA",
          installment_options: [],
          computed_at: "2026-07-01T00:00:00.000Z",
          expires_at: "2026-07-01T01:00:00.000Z",
        },
        expires_at: "2026-07-01T01:00:00.000Z",
      },
      error: null,
    });

    const { result } = renderHook(
      () => useInstallmentOptions({
        proposalId: "p-1",
        serviceId: "s-1",
        cardBrand: "VISA",
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.installment_selection_hmac).toBe("hmac");
  });

  it("throws when options are unavailable", async () => {
    vi.spyOn(cardsApi, "fetchInstallmentOptions").mockResolvedValue({
      data: null,
      error: "installment_options_unavailable",
    });

    const { result } = renderHook(
      () => useInstallmentOptions({
        proposalId: "p-1",
        serviceId: "s-1",
        cardBrand: "VISA",
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("does not fetch when disabled", () => {
    const spy = vi.spyOn(cardsApi, "fetchInstallmentOptions");
    renderHook(
      () => useInstallmentOptions({
        proposalId: "p-1",
        serviceId: "s-1",
        cardBrand: "VISA",
        enabled: false,
      }),
      { wrapper: createWrapper() },
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws fallback when response has neither data nor error", async () => {
    vi.spyOn(cardsApi, "fetchInstallmentOptions").mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () => useInstallmentOptions({
        proposalId: "p-1",
        serviceId: "s-1",
        cardBrand: "VISA",
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("installment_options_unavailable");
  });
});

describe("useInstallmentSignatureRecovery", () => {
  it("re-fetches installment options and preserves the selected card token", async () => {
    const refetchInstallments = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ paymentTokenId }: { paymentTokenId: string }) =>
        useInstallmentSignatureRecovery(paymentTokenId, refetchInstallments),
      { initialProps: { paymentTokenId: "token-abc" } },
    );

    rerender({ paymentTokenId: "token-abc" });

    await act(async () => {
      const preservedTokenId = await result.current.handleSignatureExpired();
      expect(preservedTokenId).toBe("token-abc");
    });

    expect(refetchInstallments).toHaveBeenCalledTimes(1);
    expect(result.current.paymentTokenId).toBe("token-abc");
  });
});

