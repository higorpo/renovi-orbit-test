import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchServiceRequestBudgetCompareDetail,
  rejectServiceRequestBudgetProposal,
} from "../serviceRequestBudgetCompare.api";

const getServiceByIdMock = vi.fn();
const rejectProposalMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/features/view-services", () => ({
  getServiceById: (...args: unknown[]) => getServiceByIdMock(...args),
}));

vi.mock("../proposals.api", () => ({
  rejectProposal: (...args: unknown[]) => rejectProposalMock(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

function mockProposalsQuery(rows: unknown[], publicRows: unknown[] = []) {
  const proposalsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const publicChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: publicRows, error: null }),
  };

  fromMock.mockImplementation((table: string) => {
    if (table === "provider_proposals") return proposalsChain;
    if (table === "provider_profiles_public") return publicChain;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { proposalsChain, publicChain };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchServiceRequestBudgetCompareDetail", () => {
  it("combines get_service payload with provider proposals", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: "Desc",
        listPhase: "negotiation",
        createdAt: "2026-01-01T00:00:00Z",
        service: { title: "Eletricista", slug: "eletricista", icon_key: null, color_key: null },
        address: { neighborhood: "Centro", cityName: "SP", stateAbbreviation: "SP" },
      },
      error: null,
    });

    mockProposalsQuery(
      [
        {
          id: "prop-1",
          provider_id: "prov-1",
          proposed_amount: 100,
          status: "PENDING",
          created_at: "2026-01-02T00:00:00Z",
          submitted_at: "2026-01-02T00:00:00Z",
          proposal_description: "Orçamento",
          photos: ["a.jpg"],
          profiles: { full_name: "João", profile_image_path: "avatars/joao.jpg" },
        },
      ],
      [{ provider_id: "prov-1", slug: "joao", display_name: "João Eletricista" }],
    );

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");

    expect(getServiceByIdMock).toHaveBeenCalledWith("req-1");
    expect(result.error).toBeNull();
    expect(result.data?.service_request.title).toBe("Job");
    expect(result.data?.budgets).toHaveLength(1);
    expect(result.data?.budgets[0]).toMatchObject({
      id: "prop-1",
      provider_name: "João Eletricista",
      provider_slug: "joao",
      proposed_amount: 100,
    });
  });

  it("returns error when get_service fails", async () => {
    getServiceByIdMock.mockResolvedValue({ data: null, error: "Forbidden" });
    mockProposalsQuery([]);

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Forbidden");
  });
});

describe("rejectServiceRequestBudgetProposal", () => {
  it("delegates to reject_proposal", async () => {
    rejectProposalMock.mockResolvedValue({
      data: { proposal: { id: "prop-1" } },
      error: null,
    });

    const result = await rejectServiceRequestBudgetProposal({
      proposalId: "prop-1",
      reason: "Too expensive",
    });

    expect(rejectProposalMock).toHaveBeenCalledWith({
      proposalId: "prop-1",
      rejectionReason: "Too expensive",
      idempotencyKey: undefined,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ proposal: { id: "prop-1" } });
  });

  it("returns error message from reject_proposal", async () => {
    rejectProposalMock.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN", message: "Prazo expirou" },
    });

    const result = await rejectServiceRequestBudgetProposal({
      proposalId: "prop-1",
      reason: "Too expensive",
    });

    expect(result.error).toBe("Prazo expirou");
    expect(result.data).toBeNull();
  });
});
