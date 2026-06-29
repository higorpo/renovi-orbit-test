import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptProposal,
  acceptProposalWithPayment,
  createProviderProposal,
  declineRevisionRequest,
  listProposalVersions,
  rejectProposal,
  requestProposalRevision,
} from "../proposals.api";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000002",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createProviderProposal", () => {
  it("sends service request scoped pricing fields", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: "p1",
        proposal: { id: "p1", status: "PENDING" },
        timeline_message: null,
      },
      error: null,
    });

    await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 100,
      proposalDescription: "Desc",
      proposalDurationValue: 1,
      proposalDurationUnit: "days",
      proposalSuggestedSlots: [{ start_date: "2026-06-01", shift: "morning" }],
      photos: [],
      pricing: {
        original_amount: 100,
        pricing_signature: "sig",
        tax_rate: 0.1,
        tax_amount: 10,
        final_amount: 110,
      },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "create_provider_proposal",
      expect.objectContaining({
        p_service_request_id: "sr-1",
        p_idempotency_key: "00000000-0000-7000-8000-000000000002",
        p_final_amount: 110,
      }),
    );
  });
});

describe("acceptProposal", () => {
  it("maps PROPOSAL_EXPIRED to UI message", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "PROPOSAL_EXPIRED", details: '{"code":"PROPOSAL_EXPIRED"}' },
    });

    const result = await acceptProposal({
      proposalId: "p1",
      selectedSlot: { start_date: "2026-06-01", shift: "morning" },
    });

    expect(result.error?.code).toBe("PROPOSAL_EXPIRED");
    expect(result.error?.message).toContain("expirou");
  });
});

describe("acceptProposalWithPayment", () => {
  it("passes payment fields to accept_proposal RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        service: { id: "cs-1" },
        proposal: { id: "p1", status: "ACCEPTED" },
        payment_schedule: { id: "sched-1", state: "SCHEDULED" },
      },
      error: null,
    });

    await acceptProposalWithPayment({
      proposalId: "p1",
      selectedSlot: { start_date: "2026-06-01", shift: "morning" },
      clientCardTokenId: "tok-1",
      installmentNumber: 1,
      installmentSelectionHmac: "hmac",
      installmentHmacPayload: { proposal_id: "p1" },
      clearsaleSessionId: "cs-session",
      pricingSignature: "pricing-sig",
      clientIp: "127.0.0.1",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "accept_proposal",
      expect.objectContaining({
        p_client_card_token_id: "tok-1",
        p_pricing_signature: "pricing-sig",
        p_installment_selection_hmac: "hmac",
      }),
    );
  });
});

describe("rejectProposal", () => {
  it("returns proposal payload", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1", status: "REJECTED" } },
      error: null,
    });

    const result = await rejectProposal({
      proposalId: "p1",
      rejectionReason: "Preço alto",
      idempotencyKey: "idem-r",
    });
    expect(result.data?.proposal.status).toBe("REJECTED");
  });
});

describe("requestProposalRevision", () => {
  it("passes revision reason", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1", status: "REVISION_REQUESTED" } },
      error: null,
    });

    await requestProposalRevision({
      proposalId: "p1",
      revisionReason: "PRICE_TOO_HIGH",
      revisionNotes: "Detalhe",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "request_proposal_revision",
      expect.objectContaining({
        p_revision_reason: "PRICE_TOO_HIGH",
        p_revision_notes: "Detalhe",
      }),
    );
  });
});

describe("declineRevisionRequest", () => {
  it("generates idempotency key when omitted", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1", status: "PENDING" } },
      error: null,
    });

    await declineRevisionRequest({ proposalId: "p1" });
    expect(rpcMock).toHaveBeenCalledWith(
      "decline_revision_request",
      expect.objectContaining({ p_idempotency_key: "00000000-0000-7000-8000-000000000002" }),
    );
  });
});

describe("listProposalVersions", () => {
  it("returns items array", async () => {
    rpcMock.mockResolvedValue({ data: { items: [] }, error: null });

    const result = await listProposalVersions("chat-1");
    expect(result.data?.items).toEqual([]);
  });
});
