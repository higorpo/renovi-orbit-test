import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  invokePaymentEdgeFunction,
  invokePaymentRpc,
} from "../paymentApiClient";
import { PAYMENT_EDGE } from "../payments.edge";
import { PAYMENT_RPC } from "../payments.rpc";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const invokeMock = vi.mocked(supabase.functions.invoke);
const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invokePaymentEdgeFunction", () => {
  it("returns payload on success", async () => {
    invokeMock.mockResolvedValue({
      data: { payment_token_id: "tok-1", card_brand: "VISA" },
      error: null,
    });

    const result = await invokePaymentEdgeFunction(PAYMENT_EDGE.tokenizePaymentCard, {
      cardData: { cardNumber: "4111111111111111" },
    });

    expect(result.ok).toBe(true);
    expect(result.payload.payment_token_id).toBe("tok-1");
    expect(invokeMock).toHaveBeenCalledWith(PAYMENT_EDGE.tokenizePaymentCard, {
      body: { cardData: { cardNumber: "4111111111111111" } },
    });
  });

  it("parses FunctionsHttpError body", async () => {
    const response = new Response(
      JSON.stringify({ error_code: "CARD_DECLINED", error: "Cartão recusado" }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
    const httpError = new FunctionsHttpError("Edge Function returned a non-2xx status code");
    Object.defineProperty(httpError, "context", { value: response });

    invokeMock.mockResolvedValue({ data: null, error: httpError });

    const result = await invokePaymentEdgeFunction(PAYMENT_EDGE.manualChargePayment, {
      schedule_id: "sched-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(402);
    expect(result.payload.error_code).toBe("CARD_DECLINED");
  });

  it("treats 200 responses with error field as failure", async () => {
    invokeMock.mockResolvedValue({
      data: { error_code: "INVALID_REQUEST" },
      error: null,
    });

    const result = await invokePaymentEdgeFunction(PAYMENT_EDGE.tokenizePaymentCard, {});

    expect(result.ok).toBe(false);
    expect(result.payload.error_code).toBe("INVALID_REQUEST");
  });
});

describe("invokePaymentRpc", () => {
  it("returns validated data on success", async () => {
    rpcMock.mockResolvedValue({
      data: { needs_cpf: true, needs_phone: false, needs_card: true },
      error: null,
    });

    const result = await invokePaymentRpc(
      PAYMENT_RPC.getCheckoutStepRequirements,
      {},
      (value): value is Record<string, unknown> => value !== null && typeof value === "object",
      "invalid",
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      needs_cpf: true,
      needs_phone: false,
      needs_card: true,
    });
  });

  it("maps rpc errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "PROPOSAL_NOT_FOUND", details: '{"code":"PROPOSAL_NOT_FOUND"}' },
    });

    const result = await invokePaymentRpc(
      PAYMENT_RPC.calculateInstallmentOptions,
      {
        p_proposal_id: "p-1",
        p_service_id: "s-1",
        p_card_brand: "VISA",
      },
      (value): value is Record<string, unknown> => value !== null && typeof value === "object",
      "invalid",
    );

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("PROPOSAL_NOT_FOUND");
  });
});
