import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchInstallmentOptions,
  revokePaymentToken,
  tokenizePaymentCard,
} from "../cards.api";
import { PAYMENT_EDGE } from "../payments.edge";
import { PAYMENT_RPC } from "../payments.rpc";

const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

const tokenizeRequest = {
  tokenizeContext: "checkout" as const,
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

describe("tokenizePaymentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tokenized card on success", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        payment_token_id: "tok-1",
        card_number_masked: "497010XXXXXX0048",
        card_brand: "VISA",
      },
      error: null,
    });

    const result = await tokenizePaymentCard(tokenizeRequest);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      paymentTokenId: "tok-1",
      cardNumberMasked: "497010XXXXXX0048",
      cardBrand: "VISA",
    });
    expect(mockInvoke).toHaveBeenCalledWith(PAYMENT_EDGE.tokenizePaymentCard, {
      body: expect.objectContaining({
        tokenizeContext: "checkout",
        cardData: tokenizeRequest.cardData,
      }),
    });
  });

  it("returns gateway errors from edge response", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        error: "Cartão inválido",
        error_code: "INVALID_CARD",
        errors: [{ message: "Cartão inválido", code: "INVALID_CARD" }],
      },
      error: null,
    });

    const result = await tokenizePaymentCard(tokenizeRequest);

    expect(result.data).toBeNull();
    expect(result.error).toBe("Cartão inválido");
    expect(result.gatewayErrors?.[0]?.code).toBe("INVALID_CARD");
  });
});

describe("fetchInstallmentOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed installment options from rpc", async () => {
    mockRpc.mockResolvedValue({
      data: {
        installment_options: [{ installment_number: 1, total_amount: "1000.00" }],
        installment_selection_hmac: "hmac-1",
        installment_hmac_payload: { proposal_id: "p-1" },
        expires_at: "2026-07-04T00:00:00.000Z",
      },
      error: null,
    });

    const result = await fetchInstallmentOptions({
      proposalId: "p-1",
      serviceId: "s-1",
      cardBrand: "VISA",
    });

    expect(result.error).toBeNull();
    expect(result.data?.installment_selection_hmac).toBe("hmac-1");
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.calculateInstallmentOptions, {
      p_proposal_id: "p-1",
      p_service_id: "s-1",
      p_card_brand: "VISA",
    });
  });
});

describe("revokePaymentToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns revoked outcome on success", async () => {
    mockRpc.mockResolvedValue({
      data: { client_card_token_id: "tok-1", state: "REVOKED" },
      error: null,
    });

    const result = await revokePaymentToken("tok-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ outcome: "revoked", paymentTokenId: "tok-1" });
  });

  it("returns blocked outcome when card is linked to active schedule", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE",
        details: JSON.stringify({
          code: "CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE",
          schedules: [{
            schedule_id: "sched-1",
            contracted_service_id: "service-1",
            state: "SCHEDULED",
          }],
        }),
      },
    });

    const result = await revokePaymentToken("tok-linked");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      outcome: "blocked",
      schedules: [{
        scheduleId: "sched-1",
        contractedServiceId: "service-1",
        state: "SCHEDULED",
      }],
    });
  });
});
