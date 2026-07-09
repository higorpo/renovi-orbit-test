// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as cardsApi from "../../api/cards.api";
import { useTokenizeCard } from "../useTokenizeCard";

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

const tokenizeRequest = {
  tokenizeContext: "profile" as const,
  cpf: "03019758092",
  phone: "48999999999",
  cardData: {
    cardNumber: "4970100000000048",
    cvv: "123",
    expiryMonth: 12,
    expiryYear: 2030,
    cardholderName: "Maria Silva",
  },
  billingAddress: {
    street: "Rua A",
    number: "10",
    district: "Centro",
    city: "Joinville",
    state: "SC",
    zipCode: "89201420",
  },
};

describe("useTokenizeCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns tokenized card data on success", async () => {
    vi.spyOn(cardsApi, "tokenizePaymentCard").mockResolvedValue({
      data: {
        paymentTokenId: "tok-1",
        cardNumberMasked: "497010XXXXXX0048",
        cardBrand: "VISA",
      },
      error: null,
    });

    const { result } = renderHook(() => useTokenizeCard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync(tokenizeRequest);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      paymentTokenId: "tok-1",
      cardNumberMasked: "497010XXXXXX0048",
      cardBrand: "VISA",
    });
  });

  it("throws when tokenization fails", async () => {
    vi.spyOn(cardsApi, "tokenizePaymentCard").mockResolvedValue({
      data: null,
      error: "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.",
    });

    const { result } = renderHook(() => useTokenizeCard(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.mutateAsync(tokenizeRequest);
      }),
    ).rejects.toThrow(/recusado/);
  });
});
