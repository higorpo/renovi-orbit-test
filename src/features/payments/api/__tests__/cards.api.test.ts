import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchInstallmentOptions,
  fetchPaymentTokenById,
  listActivePaymentTokens,
  mapCardFormToTokenizeRequest,
  revokePaymentToken,
  tokenizePaymentCard,
  updatePaymentMethod,
} from "../cards.api";
import { PAYMENT_EDGE } from "../payments.edge";
import { PAYMENT_RPC } from "../payments.rpc";

const mockRpc = vi.fn();
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
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
    expect(result.error).toContain("validar este cartão");
    expect(result.gatewayErrors?.[0]?.code).toBe("INVALID_CARD");
  });

  it("maps tokenize failures without a gateway errors array", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        error: "Tokenize failed",
        error_code: "TOKENIZE_FAILED",
      },
      error: null,
    });

    const result = await tokenizePaymentCard(tokenizeRequest);

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.gatewayErrors).toBeUndefined();
  });
});

function createSelectChain<T>(result: { data: T; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

describe("listActivePaymentTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "client-1" } },
      error: null,
    });
  });

  it("reads active tokens from client_card_tokens_safe_v for the session user", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: [{
          id: "tok-1",
          card_number_masked: "497010XXXXXX0048",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        }],
        error: null,
      }),
    );

    const result = await listActivePaymentTokens();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(mockFrom).toHaveBeenCalledWith("client_card_tokens_safe_v");
  });

  it("returns empty list on error", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: null,
        error: { message: "list failed" },
      }),
    );

    await expect(listActivePaymentTokens()).resolves.toEqual({
      data: [],
      error: "list failed",
    });
  });
});

describe("fetchPaymentTokenById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads token from client_card_tokens_safe_v", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: {
          id: "tok-1",
          card_number_masked: "497010XXXXXX0048",
          card_brand: "VISA",
          expiry_month: 12,
          expiry_year: 2030,
          state: "ACTIVE",
        },
        error: null,
      }),
    );

    const result = await fetchPaymentTokenById("tok-1");

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("tok-1");
    expect(mockFrom).toHaveBeenCalledWith("client_card_tokens_safe_v");
  });

  it("returns error when token fetch fails", async () => {
    mockFrom.mockReturnValue(
      createSelectChain({
        data: null,
        error: { message: "token failed" },
      }),
    );

    await expect(fetchPaymentTokenById("tok-1")).resolves.toEqual({
      data: null,
      error: "token failed",
    });
  });
});

describe("updatePaymentMethod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes installment HMAC payload to payment_update_method RPC", async () => {
    mockRpc.mockResolvedValue({
      data: { schedule_id: "sched-1" },
      error: null,
    });

    const result = await updatePaymentMethod({
      contractedServiceId: "service-1",
      newPaymentTokenId: "tok-2",
      installmentSelectionHmac: "hmac-1",
      installmentHmacPayload: { proposal_id: "proposal-1" },
      installmentNumber: 3,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ scheduleId: "sched-1" });
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.updatePaymentMethod, {
      p_service_id: "service-1",
      p_new_client_card_token_id: "tok-2",
      p_installment_selection_hmac: "hmac-1",
      p_installment_hmac_payload: { proposal_id: "proposal-1" },
      p_installment_number: 3,
    });
  });

  it("maps RPC errors and invalid responses", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "UPDATE_FAILED", code: "UPDATE_FAILED" },
    });

    await expect(
      updatePaymentMethod({
        contractedServiceId: "service-1",
        newPaymentTokenId: "tok-2",
      }),
    ).resolves.toMatchObject({
      data: null,
      errorCode: "UPDATE_FAILED",
    });

    mockRpc.mockResolvedValue({
      data: { unexpected: true },
      error: null,
    });

    await expect(
      updatePaymentMethod({
        contractedServiceId: "service-1",
        newPaymentTokenId: "tok-2",
      }),
    ).resolves.toEqual({
      data: null,
      error: "Não foi possível atualizar o cartão. Tente novamente.",
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      updatePaymentMethod({
        contractedServiceId: "service-1",
        newPaymentTokenId: "tok-2",
      }),
    ).resolves.toEqual({
      data: null,
      error: "Resposta inesperada do servidor. Tente novamente.",
      errorCode: "INVALID_RESPONSE",
    });
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

describe("mapCardFormToTokenizeRequest", () => {
  it("maps form values and defaults tokenize context", () => {
    const request = mapCardFormToTokenizeRequest(
      {
        cardNumber: "4111 1111 1111 1111",
        expiryMonth: "12",
        expiryYear: "30",
        cvv: "123",
        cardholderName: " Maria ",
        cardholderCpf: "390.533.447-05",
        street: " Rua A ",
        number: " 10 ",
        additionalDetails: "  ",
        district: " Centro ",
        city: " Floripa ",
        state: "sc",
        zipCode: "88000-000",
      },
      {
        providerServiceId: "proposal-1",
        phone: "(48) 99999-9999",
      },
    );

    expect(request.tokenizeContext).toBe("checkout");
    expect(request.cardData.cardNumber).toBe("4111111111111111");
    expect(request.cardData.expiryYear).toBe(2030);
    expect(request.billingAddress.state).toBe("SC");
    expect(request.billingAddress.additionalDetails).toBeUndefined();
    expect(request.cpf).toBe("39053344705");
  });

  it("defaults profile context without providerServiceId", () => {
    const request = mapCardFormToTokenizeRequest(
      {
        cardNumber: "4111111111111111",
        expiryMonth: "12",
        expiryYear: "2030",
        cvv: "123",
        cardholderName: "Maria",
        cardholderCpf: "529.982.247-25",
        street: "Rua A",
        number: "10",
        district: "Centro",
        city: "Floripa",
        state: "SC",
        zipCode: "88000000",
      },
      {
        phone: "48999999999",
      },
    );

    expect(request.tokenizeContext).toBe("profile");
    expect(request.cpf).toBe("52998224725");
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

  it("returns empty blocked schedules when payload is not an array", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE",
        details: JSON.stringify({
          code: "CARD_TOKEN_LINKED_TO_ACTIVE_SCHEDULE",
          schedules: "bad",
        }),
      },
    });

    const result = await revokePaymentToken("tok-linked");
    expect(result.data).toEqual({
      outcome: "blocked",
      schedules: [],
    });
  });

  it("returns not_found for missing tokens and error for unexpected failures", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "CLIENT_CARD_TOKEN_NOT_FOUND",
        details: JSON.stringify({ code: "CLIENT_CARD_TOKEN_NOT_FOUND" }),
      },
    });

    await expect(revokePaymentToken("missing")).resolves.toEqual({
      data: { outcome: "not_found" },
      error: null,
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "no rows returned", code: "P0002" },
    });

    await expect(revokePaymentToken("missing-p0002")).resolves.toEqual({
      data: { outcome: "not_found" },
      error: null,
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "unexpected", details: "{}" },
    });

    await expect(revokePaymentToken("tok-1")).resolves.toEqual({
      data: null,
      error: "Não foi possível remover este cartão. Tente novamente.",
    });
  });
});
