import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  acceptProposalWithPayment,
  fetchInstallmentOptions,
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

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000003",
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
    });
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.getProposalCheckoutContext, {
      p_proposal_id: "proposal-1",
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

describe("acceptProposalWithPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes payment fields to accept_proposal RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        service: {
          id: "cs-1",
          service_request_id: "sr-1",
          accepted_proposal_id: "proposal-1",
          status: "PENDING_PAYMENT",
          scheduled_start_date: "2026-07-10",
          scheduled_shift: "morning",
          agreed_slot: { start_date: "2026-07-10", shift: "morning" },
        },
        proposal: {
          id: "proposal-1",
          status: "ACCEPTED",
          selected_slot: { start_date: "2026-07-10", shift: "morning" },
          provider_id: "provider-1",
        },
        payment_schedule: {
          id: "schedule-1",
          state: "SCHEDULED",
          charge_scheduled_at: "2026-07-08T12:00:00.000Z",
        },
      },
      error: null,
    });

    const result = await acceptProposalWithPayment({
      proposalId: "proposal-1",
      selectedSlot: { start_date: "2026-07-10", shift: "morning" },
      clientCardTokenId: "token-1",
      installmentNumber: 1,
      installmentSelectionHmac: "hmac-1",
      installmentHmacPayload: { proposal_id: "proposal-1" },
      clearsaleSessionId: "session-1",
      pricingSignature: "sig-1",
      clientIp: "189.0.0.1",
    });

    expect(result.error).toBeNull();
    expect(result.data?.payment_schedule?.id).toBe("schedule-1");
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.acceptProposal, {
      p_proposal_id: "proposal-1",
      p_selected_slot: { start_date: "2026-07-10", shift: "morning" },
      p_idempotency_key: "00000000-0000-7000-8000-000000000003",
      p_client_card_token_id: "token-1",
      p_installment_number: 1,
      p_installment_selection_hmac: "hmac-1",
      p_installment_hmac_payload: { proposal_id: "proposal-1" },
      p_clearsale_session_id: "session-1",
      p_pricing_signature: "sig-1",
      p_client_ip: "189.0.0.1",
    });
  });
});
