import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchServiceRequestBudgetCompareDetail,
  rejectServiceRequestBudgetProposal,
} from "../serviceRequestBudgetCompare.api";

const getServiceByIdMock = vi.fn();
const rejectProposalMock = vi.fn();
const fromMock = vi.fn();
const rpcMock = vi.fn();

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
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

function mockProposalsQuery(
  rows: unknown[],
  publicRows: unknown[] = [],
  ratingRows: unknown[] = [],
) {
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

  rpcMock.mockResolvedValue({ data: ratingRows, error: null });

  return { proposalsChain, publicChain };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchServiceRequestBudgetCompareDetail", () => {
  it("combines get_service payload with provider proposals and rating summaries", async () => {
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
          revision_count: 0,
          status: "PENDING",
          created_at: "2026-01-02T00:00:00Z",
          submitted_at: "2026-01-02T00:00:00Z",
          proposal_description: "Orçamento",
          proposal_suggested_slots: [
            { start_date: "2026-06-12", shift: "afternoon" },
            { start_date: "2026-06-14", shift: "morning" },
          ],
          photos: ["a.jpg"],
          profiles: { full_name: "João", profile_image_path: "avatars/joao.jpg" },
        },
      ],
      [{ provider_id: "prov-1", slug: "joao", display_name: "João Eletricista" }],
      [
        {
          provider_id: "prov-1",
          rating_avg: 4.7,
          rating_count: 12,
          completed_services_count: 34,
        },
      ],
    );

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");

    expect(getServiceByIdMock).toHaveBeenCalledWith("req-1");
    expect(rpcMock).toHaveBeenCalledWith("get_provider_rating_summaries", {
      p_provider_ids: ["prov-1"],
    });
    expect(result.error).toBeNull();
    expect(result.data?.service_request.title).toBe("Job");
    expect(result.data?.budgets).toHaveLength(1);
    expect(result.data?.budgets[0]).toMatchObject({
      id: "prop-1",
      provider_name: "João Eletricista",
      provider_slug: "joao",
      proposed_amount: 100,
      rating_avg: 4.7,
      rating_count: 12,
      completed_services_count: 34,
      proposal_suggested_slots: [
        { start_date: "2026-06-12", shift: "afternoon" },
        { start_date: "2026-06-14", shift: "morning" },
      ],
    });
  });

  it("returns validation error for blank service request id", async () => {
    const result = await fetchServiceRequestBudgetCompareDetail("   ");
    expect(result.data).toBeNull();
    expect(result.error).toBe("ID do pedido é obrigatório");
    expect(getServiceByIdMock).not.toHaveBeenCalled();
  });

  it("returns error when get_service fails", async () => {
    getServiceByIdMock.mockResolvedValue({ data: null, error: "Forbidden" });
    mockProposalsQuery([]);

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Forbidden");
  });

  it("returns not found when service payload is missing", async () => {
    getServiceByIdMock.mockResolvedValue({ data: null, error: null });
    mockProposalsQuery([]);

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Pedido não encontrado");
  });

  it("returns proposals query error", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "negotiation",
        createdAt: "2026-01-01T00:00:00Z",
        service: null,
        address: null,
      },
      error: null,
    });

    const proposalsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "proposals down" } }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("proposals down");
  });

  it("returns public profile query error", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "negotiation",
        createdAt: "2026-01-01T00:00:00Z",
        service: { title: "S", slug: "s", icon_key: null, color_key: null },
        address: null,
      },
      error: null,
    });

    const proposalsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "prop-1",
            provider_id: "prov-1",
            proposed_amount: 50,
            revision_count: null,
            status: "PENDING",
            created_at: "2026-01-02T00:00:00Z",
            submitted_at: null,
            proposal_description: "x",
            proposal_suggested_slots: null,
            photos: null,
            profiles: [{ full_name: "Ana", profile_image_path: null }],
          },
        ],
        error: null,
      }),
    };
    const publicChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: { message: "public profiles down" } }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChain;
      if (table === "provider_profiles_public") return publicChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("public profiles down");
  });

  it("returns rating summaries query error", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "negotiation",
        createdAt: "2026-01-01T00:00:00Z",
        service: { title: "S", slug: "s", icon_key: null, color_key: null },
        address: null,
      },
      error: null,
    });

    const proposalsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "prop-1",
            provider_id: "prov-1",
            proposed_amount: 50,
            revision_count: 0,
            status: "PENDING",
            created_at: "2026-01-02T00:00:00Z",
            submitted_at: null,
            proposal_description: "x",
            proposal_suggested_slots: null,
            photos: null,
            profiles: { full_name: "Ana", profile_image_path: null },
          },
        ],
        error: null,
      }),
    };
    const publicChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ provider_id: "prov-1", slug: "ana", display_name: "Ana" }],
        error: null,
      }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChain;
      if (table === "provider_profiles_public") return publicChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    rpcMock.mockResolvedValue({ data: null, error: { message: "ratings down" } });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("ratings down");
  });

  it("falls back to profile full name and Prestador when display name is missing", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "open",
        createdAt: "2026-01-01T00:00:00Z",
        service: null,
        address: null,
      },
      error: null,
    });

    mockProposalsQuery(
      [
        {
          id: "prop-1",
          provider_id: "prov-1",
          proposed_amount: 10,
          revision_count: 1,
          status: "PENDING",
          created_at: "2026-01-02T00:00:00Z",
          submitted_at: null,
          proposal_description: "x",
          proposal_suggested_slots: [],
          photos: null,
          profiles: [{ full_name: "  Maria  ", profile_image_path: null }],
        },
        {
          id: "prop-2",
          provider_id: "prov-2",
          proposed_amount: 20,
          revision_count: 0,
          status: "PENDING",
          created_at: "2026-01-03T00:00:00Z",
          submitted_at: null,
          proposal_description: "y",
          proposal_suggested_slots: [],
          photos: [],
          profiles: null,
        },
      ],
      [
        { provider_id: "prov-1", slug: "maria", display_name: "   " },
        { provider_id: "prov-2", slug: null, display_name: null },
      ],
      [
        {
          provider_id: "prov-1",
          rating_avg: null,
          rating_count: 0,
          completed_services_count: 5,
        },
        {
          provider_id: "prov-2",
          rating_avg: null,
          rating_count: 0,
          completed_services_count: 0,
        },
      ],
    );

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.error).toBeNull();
    expect(result.data?.budgets[0]).toMatchObject({
      provider_name: "Maria",
      provider_slug: "maria",
      photos: [],
      rating_avg: null,
      rating_count: 0,
      completed_services_count: 5,
    });
    expect(result.data?.budgets[1]).toMatchObject({
      provider_name: "Prestador",
      provider_slug: null,
      rating_avg: null,
      rating_count: 0,
      completed_services_count: 0,
    });
    expect(result.data?.service_request).toMatchObject({
      service_title: "",
      service_slug: "",
      neighborhood: null,
      city: null,
      state_abbr: null,
    });
  });

  it("treats empty profiles array as missing profile and null public rows as empty", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "open",
        createdAt: "2026-01-01T00:00:00Z",
        service: null,
        address: null,
      },
      error: null,
    });

    const proposalsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "prop-1",
            provider_id: "prov-1",
            proposed_amount: 10,
            revision_count: 0,
            status: "PENDING",
            created_at: "2026-01-02T00:00:00Z",
            submitted_at: null,
            proposal_description: "x",
            proposal_suggested_slots: [],
            photos: [],
            profiles: [],
          },
        ],
        error: null,
      }),
    };
    const publicChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChain;
      if (table === "provider_profiles_public") return publicChain;
      throw new Error(`Unexpected table: ${table}`);
    });
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.error).toBeNull();
    expect(result.data?.budgets[0]).toMatchObject({
      provider_name: "Prestador",
      provider_slug: null,
      provider_profile_image_path: null,
      rating_avg: null,
      rating_count: 0,
      completed_services_count: 0,
    });
  });

  it("skips public profile and rating fetch when there are no proposals", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "open",
        createdAt: "2026-01-01T00:00:00Z",
        service: null,
        address: null,
      },
      error: null,
    });
    mockProposalsQuery([]);

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.error).toBeNull();
    expect(result.data?.budgets).toEqual([]);
    expect(fromMock).toHaveBeenCalledWith("provider_proposals");
    expect(fromMock).not.toHaveBeenCalledWith("provider_profiles_public");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("treats empty profiles array as missing and null proposal rows as empty", async () => {
    getServiceByIdMock.mockResolvedValue({
      data: {
        id: "req-1",
        title: "Job",
        description: null,
        listPhase: "open",
        createdAt: "2026-01-01T00:00:00Z",
        service: { title: "S", slug: "s", icon_key: "bolt", color_key: "blue" },
        address: { neighborhood: "Centro", cityName: "SP", stateAbbreviation: "SP" },
      },
      error: null,
    });

    const proposalsChainEmpty = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChainEmpty;
      throw new Error(`Unexpected table: ${table}`);
    });

    const emptyResult = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(emptyResult.error).toBeNull();
    expect(emptyResult.data?.budgets).toEqual([]);
    expect(emptyResult.data?.service_request).toMatchObject({
      service_title: "S",
      service_icon_key: "bolt",
      neighborhood: "Centro",
    });

    const proposalsChain2 = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "prop-1",
            provider_id: "prov-1",
            proposed_amount: 10,
            revision_count: null,
            status: "PENDING",
            created_at: "2026-01-02T00:00:00Z",
            submitted_at: null,
            proposal_description: "x",
            proposal_suggested_slots: null,
            photos: "not-an-array",
            profiles: [],
          },
        ],
        error: null,
      }),
    };
    const publicChain2 = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "provider_proposals") return proposalsChain2;
      if (table === "provider_profiles_public") return publicChain2;
      throw new Error(`Unexpected table: ${table}`);
    });
    rpcMock.mockResolvedValue({
      data: [
        {
          provider_id: "prov-1",
          rating_avg: "4.2",
          rating_count: 3,
          completed_services_count: 8,
        },
      ],
      error: null,
    });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.error).toBeNull();
    expect(result.data?.budgets[0]).toMatchObject({
      provider_name: "Prestador",
      revision_count: 0,
      photos: [],
      provider_slug: null,
      rating_avg: 4.2,
      rating_count: 3,
      completed_services_count: 8,
    });
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

  it("forwards idempotency key to reject_proposal", async () => {
    rejectProposalMock.mockResolvedValue({
      data: { proposal: { id: "prop-1" } },
      error: null,
    });

    await rejectServiceRequestBudgetProposal({
      proposalId: "prop-1",
      reason: "Too expensive",
      idempotencyKey: "idem-1",
    });

    expect(rejectProposalMock).toHaveBeenCalledWith({
      proposalId: "prop-1",
      rejectionReason: "Too expensive",
      idempotencyKey: "idem-1",
    });
  });
});
