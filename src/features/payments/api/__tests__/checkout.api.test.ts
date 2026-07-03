import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCheckoutStepRequirements,
  getProposalCheckoutContext,
} from "../checkout.api";
import { PAYMENT_RPC } from "../payments.rpc";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

describe("getCheckoutStepRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns step requirements from rpc", async () => {
    mockRpc.mockResolvedValue({
      data: { needs_cpf: true, needs_phone: false, needs_card: true },
      error: null,
    });

    const result = await getCheckoutStepRequirements();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      needs_cpf: true,
      needs_phone: false,
      needs_card: true,
    });
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.getCheckoutStepRequirements, {});
  });

  it("maps rpc errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "UNAUTHORIZED", details: '{"code":"UNAUTHORIZED"}' },
    });

    const result = await getCheckoutStepRequirements();

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("getProposalCheckoutContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal checkout context from rpc", async () => {
    mockRpc.mockResolvedValue({
      data: {
        proposal_id: "proposal-1",
        service_request_id: "sr-1",
        provider_id: "provider-1",
        proposed_amount: 500,
        pricing_signature: "sig-1",
        payment_required: true,
      },
      error: null,
    });

    const result = await getProposalCheckoutContext("proposal-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      proposalId: "proposal-1",
      serviceRequestId: "sr-1",
      providerId: "provider-1",
      proposedAmount: 500,
      pricingSignature: "sig-1",
      paymentRequired: true,
    });
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.getProposalCheckoutContext, {
      p_proposal_id: "proposal-1",
    });
  });
});
