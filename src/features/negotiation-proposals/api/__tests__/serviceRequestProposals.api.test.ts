import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProviderProposal,
  fetchProviderProposalHistory,
  getProposalDetail,
} from "../proposals.api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

function createHistoryChain(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then(resolve: (v: typeof result) => void) {
      queueMicrotask(() => resolve(result));
    },
  };
  return chain;
}

describe("createProviderProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates proposal via rpc with pricing signature", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: "proposal-1",
        proposal: { id: "proposal-1", status: "PENDING" },
        timeline_message: null,
      },
      error: null,
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 500,
      proposalDescription: "Consigo iniciar amanhã cedo.",
      proposalDurationValue: 5,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [{ start_date: "2026-03-25", shift: "morning" }],
      photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      pricing: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_provider_proposal", {
      p_service_request_id: "sr-1",
      p_proposed_amount: 500,
      p_proposal_description: "Consigo iniciar amanhã cedo.",
      p_proposal_duration_value: 5,
      p_proposal_duration_unit: "hours",
      p_proposal_suggested_slots: [{ start_date: "2026-03-25", shift: "morning" }],
      p_photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      p_tax_rate: 0.15,
      p_tax_amount: 75,
      p_final_amount: 425,
      p_pricing_signature: "sig-123",
    });
    expect(result.error).toBeNull();
    expect(result.data?.id).toBe("proposal-1");
  });

  it("returns mapped rpc error message", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Duplicate" },
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 1,
      proposalDescription: "x",
      proposalDurationValue: 1,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [],
      photos: [],
      pricing: {
        original_amount: 1,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 1,
        pricing_signature: "s",
      },
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Duplicate");
  });

  it("returns fallback when id missing in payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: { foo: "bar" },
      error: null,
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 1,
      proposalDescription: "x",
      proposalDurationValue: 1,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [],
      photos: [],
      pricing: {
        original_amount: 1,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 1,
        pricing_signature: "s",
      },
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Resposta inesperada do servidor.");
  });
});

describe("fetchProviderProposalHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rows on success", async () => {
    const row = {
      id: "p1",
      proposed_amount: 100,
      proposal_description: "d",
      proposal_duration_value: 1,
      proposal_duration_unit: "hours",
      proposal_suggested_slots: [],
      status: "PENDING",
      tax_rate: 0,
      tax_amount: 0,
      final_amount: 100,
      photos: [],
      created_at: "t",
      updated_at: "t",
      client_rejection_response: null,
    };
    mocks.from.mockReturnValue(createHistoryChain({ data: [row], error: null }));

    const result = await fetchProviderProposalHistory("sr-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([row]);
  });

  it("returns empty list with error when query fails", async () => {
    mocks.from.mockReturnValue(createHistoryChain({ data: null, error: { message: "boom" } }));

    const result = await fetchProviderProposalHistory("sr-1");

    expect(result.data).toEqual([]);
    expect(result.error).toBe("boom");
  });
});

describe("getProposalDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal row on success", async () => {
    const row = {
      id: "p1",
      service_request_id: "sr-1",
      provider_id: "provider-1",
      status: "PENDING",
      version: 1,
      revision_count: 0,
      revision_reason: null,
      revision_notes: null,
      submitted_at: "t",
      expired_at: null,
      proposed_amount: 100,
      tax_rate: 0,
      tax_amount: 0,
      final_amount: 100,
      proposal_description: "desc",
      proposal_duration_unit: "hours",
      proposal_duration_value: 1,
      proposal_suggested_slots: [],
      photos: [],
      client_rejection_response: null,
      client_response_deadline_at: null,
      created_at: "t",
      updated_at: "t",
    };
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
    });

    const result = await getProposalDetail("p1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual(row);
  });

  it("returns not found when row is missing", async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await getProposalDetail("missing");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Proposta não encontrada.");
  });
});
