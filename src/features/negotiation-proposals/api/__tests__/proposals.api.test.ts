import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptProposal,
  declineRevisionRequest,
  listProposalVersions,
  rejectProposal,
  requestProposalRevision,
  submitProposal,
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

describe("submitProposal", () => {
  it("sends idempotency key and pricing fields", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1" }, timeline_message: { id: "m1" } },
      error: null,
    });

    await submitProposal({
      chatId: "chat-1",
      idempotencyKey: "idem-1",
      proposedAmount: 100,
      proposalDescription: "Desc",
      proposalDurationValue: 1,
      proposalDurationUnit: "days",
      proposalSuggestedSlots: [{ start_date: "2026-06-01", shift: "morning" }],
      pricing: {
        pricingSignature: "sig",
        taxRate: 0.1,
        taxAmount: 10,
        finalAmount: 110,
      },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "submit_proposal",
      expect.objectContaining({
        p_chat_id: "chat-1",
        p_idempotency_key: "idem-1",
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

describe("rejectProposal", () => {
  it("returns proposal payload", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1", status: "REJECTED", chat_id: "c1" } },
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
      data: { proposal: { id: "p1", status: "REVISION_REQUESTED", chat_id: "c1" } },
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
      data: { proposal: { id: "p1", status: "PENDING", chat_id: "c1" } },
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
