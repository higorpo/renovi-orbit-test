import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptProposalWithPayment,
  createProviderProposal,
  declineRevisionRequest,
  fetchProviderProposalHistory,
  getProposalDetail,
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

describe("acceptProposalWithPayment", () => {
  it("maps PROPOSAL_EXPIRED to UI message", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "PROPOSAL_EXPIRED", details: '{"code":"PROPOSAL_EXPIRED"}' },
    });

    const result = await acceptProposalWithPayment({
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

    expect(result.error?.code).toBe("PROPOSAL_EXPIRED");
    expect(result.error?.message).toContain("expirou");
  });

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
        p_client_ip: "127.0.0.1",
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

  it("maps invalid RPC payloads to UNKNOWN", async () => {
    rpcMock.mockResolvedValue({ data: { not_items: true }, error: null });
    const result = await listProposalVersions("chat-1");
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("UNKNOWN");
    expect(result.error?.message).toMatch(/inesperada/i);
  });
});

describe("getProposalDetail", () => {
  it("returns provider detail when found", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: "p1",
        service_request_id: "sr-1",
        provider_id: "prov-1",
        status: "PENDING",
        version: 1,
        revision_count: 0,
        revision_reason: null,
        revision_notes: null,
        submitted_at: null,
        expired_at: null,
        expires_at: null,
        proposed_amount: 100,
        proposal_description: "Desc",
        proposal_duration_value: 1,
        proposal_duration_unit: "days",
        proposal_suggested_slots: [],
        selected_slot: null,
        photos: [],
        client_rejection_response: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const result = await getProposalDetail("p1", "provider");
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("p1");
  });

  it("returns not found when provider detail is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await getProposalDetail("p1", "provider");
    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/não encontrada/i);
  });

  it("returns client audience detail when found", async () => {
    rpcMock.mockResolvedValue({
      data: {
        id: "p1",
        service_request_id: "sr-1",
        provider_id: "prov-1",
        status: "PENDING",
        version: 1,
        revision_count: 0,
        revision_reason: null,
        revision_notes: null,
        submitted_at: null,
        expired_at: null,
        expires_at: null,
        proposed_amount: 100,
        proposal_description: "Desc",
        proposal_duration_value: 1,
        proposal_duration_unit: "days",
        proposal_suggested_slots: [],
        selected_slot: null,
        photos: [],
        client_rejection_response: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const result = await getProposalDetail("p1", "client");
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("p1");
    expect(rpcMock).toHaveBeenCalledWith(
      expect.stringMatching(/participant|client/i),
      expect.any(Object),
    );
  });

  it("returns not found when client detail is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await getProposalDetail("p1", "client");
    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/não encontrada/i);
  });

  it("forwards provider and client RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "PROVIDER_DOWN", details: '{"code":"UNKNOWN"}' },
    });
    const provider = await getProposalDetail("p1", "provider");
    expect(provider.data).toBeNull();
    expect(provider.error).toBeTruthy();

    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "CLIENT_DOWN", details: '{"code":"UNKNOWN"}' },
    });
    const client = await getProposalDetail("p1", "client");
    expect(client.data).toBeNull();
    expect(client.error).toBeTruthy();
  });
});

describe("fetchProviderProposalHistory", () => {
  it("returns history items", async () => {
    rpcMock.mockResolvedValue({
      data: { items: [{ id: "p1", status: "REJECTED" }] },
      error: null,
    });
    const result = await fetchProviderProposalHistory("sr-1");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it("returns empty list on RPC error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "down" },
    });
    const result = await fetchProviderProposalHistory("sr-1");
    expect(result.data).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

describe("proposals API branch coverage", () => {
  const createParams = {
    serviceRequestId: "sr-1",
    proposedAmount: 100,
    proposalDescription: "Desc",
    proposalDurationValue: 1,
    proposalDurationUnit: "days" as const,
    proposalSuggestedSlots: [{ start_date: "2099-06-01", shift: "morning" as const }],
    photos: [],
    pricing: {
      original_amount: 100,
      pricing_signature: "sig",
      tax_rate: 0.1,
      tax_amount: 10,
      final_amount: 110,
    },
  };

  const acceptParams = {
    proposalId: "p1",
    selectedSlot: { start_date: "2099-06-01", shift: "morning" as const },
    clientCardTokenId: "tok-1",
    installmentNumber: 1,
    installmentSelectionHmac: "hmac",
    installmentHmacPayload: { proposal_id: "p1" },
    clearsaleSessionId: "cs-session",
    pricingSignature: "pricing-sig",
  };

  it("maps reject and decline RPC errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "DOWN", details: '{"code":"UNKNOWN"}' },
    });

    await expect(
      rejectProposal({ proposalId: "p1", rejectionReason: "No" }),
    ).resolves.toMatchObject({ data: null, error: expect.any(Object) });
    await expect(
      declineRevisionRequest({ proposalId: "p1" }),
    ).resolves.toMatchObject({ data: null, error: expect.any(Object) });
  });

  it("rejects invalid mutation responses", async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });

    const results = await Promise.all([
      createProviderProposal(createParams),
      acceptProposalWithPayment(acceptParams),
      rejectProposal({ proposalId: "p1", rejectionReason: "No" }),
      requestProposalRevision({
        proposalId: "p1",
        revisionReason: "PRICE_TOO_HIGH",
      }),
      declineRevisionRequest({ proposalId: "p1" }),
    ]);

    for (const result of results) {
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("UNKNOWN");
      expect(result.error?.message).toMatch(/inesperada/i);
    }
  });

  it("rejects create responses missing the proposal object", async () => {
    rpcMock.mockResolvedValue({ data: { id: "p1", proposal: null }, error: null });

    await expect(createProviderProposal(createParams)).resolves.toMatchObject({
      data: null,
      error: { code: "UNKNOWN" },
    });
  });

  it("rejects accept responses missing either service or proposal", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: { service: { id: "s1" }, proposal: null }, error: null })
      .mockResolvedValueOnce({ data: { service: null, proposal: { id: "p1" } }, error: null });

    await expect(acceptProposalWithPayment(acceptParams)).resolves.toMatchObject({ data: null });
    await expect(acceptProposalWithPayment(acceptParams)).resolves.toMatchObject({ data: null });
  });

  it("sends null when revision notes are omitted", async () => {
    rpcMock.mockResolvedValue({
      data: { proposal: { id: "p1", status: "REVISION_REQUESTED" } },
      error: null,
    });

    await requestProposalRevision({
      proposalId: "p1",
      revisionReason: "PRICE_TOO_HIGH",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "request_proposal_revision",
      expect.objectContaining({ p_revision_notes: null }),
    );
  });

  it("rejects malformed proposal detail rows for both audiences", async () => {
    rpcMock.mockResolvedValue({ data: { id: "p1" }, error: null });

    const provider = await getProposalDetail("p1", "provider");
    const client = await getProposalDetail("p1", "client");

    expect(provider).toMatchObject({ data: null, error: { code: "UNKNOWN" } });
    expect(client).toMatchObject({ data: null, error: { code: "UNKNOWN" } });
  });

  it("returns an error and empty history for malformed payloads", async () => {
    rpcMock.mockResolvedValue({ data: "invalid", error: null });

    await expect(fetchProviderProposalHistory("sr-1")).resolves.toEqual({
      data: [],
      error: "Resposta inesperada do servidor.",
    });
  });

  it("passes custom idempotency keys through every mutation", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: { id: "p1", proposal: { id: "p1" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { service: { id: "s1" }, proposal: { id: "p1" } },
        error: null,
      })
      .mockResolvedValue({
        data: { proposal: { id: "p1" } },
        error: null,
      });

    await createProviderProposal({ ...createParams, idempotencyKey: "custom-create" });
    await acceptProposalWithPayment({ ...acceptParams, idempotencyKey: "custom-accept" });
    await rejectProposal({
      proposalId: "p1",
      rejectionReason: "No",
      idempotencyKey: "custom-reject",
    });
    await requestProposalRevision({
      proposalId: "p1",
      revisionReason: "PRICE_TOO_HIGH",
      idempotencyKey: "custom-revision",
    });
    await declineRevisionRequest({
      proposalId: "p1",
      idempotencyKey: "custom-decline",
    });

    expect(rpcMock.mock.calls.map(([, args]) => args.p_idempotency_key)).toEqual([
      "custom-create",
      "custom-accept",
      "custom-reject",
      "custom-revision",
      "custom-decline",
    ]);
  });
});
