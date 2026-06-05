import { describe, it, expect, vi, beforeEach } from "vitest";
import { listServiceRequests, cancelServiceRequest } from "../serviceRequests.api";
import type { StatusTabId } from "../../constants/statusTabs";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const fromMock = vi.mocked(supabase.from);
const rpcMock = vi.mocked(supabase.rpc);
const getUserMock = vi.mocked(supabase.auth.getUser);

let terminalReturns: Array<{ data: unknown; error: { message: string } | null; count?: number | null }> = [];

function makeQueryChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "eq", "neq", "order", "range", "in", "not", "or", "gte", "lte", "is", "returns", "update",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  const thenable = {
    ...chain,
    then(onFulfilled: (v: unknown) => unknown) {
      const result = terminalReturns.shift();
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return thenable;
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalReturns = [];
  fromMock.mockReturnValue(makeQueryChain() as never);
  rpcMock.mockResolvedValue({ data: [], error: null } as never);
});

const baseParams = {
  clientId: "client-1",
  page: 1,
  pageSize: 10,
  statusTabId: "all" as const,
};

describe("listServiceRequests", () => {
  it("returns paginated data on success", async () => {
    const items = [{ id: "sr-1", status: "open" }];
    terminalReturns = [{ data: items, error: null, count: 1 }];

    const result = await listServiceRequests(baseParams);
    expect(result.data?.items).toEqual(items);
    expect(result.data?.total_count).toBe(1);
    expect(result.error).toBeNull();
  });

  it("returns error on DB failure", async () => {
    terminalReturns = [{ data: null, error: { message: "DB error" }, count: null }];

    const result = await listServiceRequests(baseParams);
    expect(result.data).toBeNull();
    expect(result.error).toBe("DB error");
  });

  it("returns empty result for dispute tab without focused ID", async () => {
    const result = await listServiceRequests({
      ...baseParams,
      statusTabId: "dispute",
    });
    expect(result.data?.items).toEqual([]);
    expect(result.data?.total_count).toBe(0);
    expect(result.error).toBeNull();
  });

  it("clamps page to minimum 1", async () => {
    const items = [{ id: "sr-1" }];
    terminalReturns = [{ data: items, error: null, count: 1 }];

    const result = await listServiceRequests({ ...baseParams, page: -5 });
    expect(result.error).toBeNull();
    expect(result.data?.page).toBe(1);
  });

  it("clamps pageSize to max 100", async () => {
    const items: unknown[] = [];
    terminalReturns = [{ data: items, error: null, count: 0 }];

    const result = await listServiceRequests({ ...baseParams, pageSize: 500 });
    expect(result.data?.page_size).toBe(100);
  });

  it("negotiation tab queries OPEN service requests", async () => {
    const chain = makeQueryChain();
    fromMock.mockReturnValue(chain as never);
    terminalReturns = [{ data: [{ id: "sr-neg", status: "OPEN" }], error: null, count: 1 }];

    const result = await listServiceRequests({
      ...baseParams,
      statusTabId: "negotiation",
    });
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([{ id: "sr-neg", status: "OPEN" }]);
    expect(chain.eq).toHaveBeenCalledWith("status", "OPEN");
  });

  it("returns error when proposals fetch fails (hasProposals filter)", async () => {
    terminalReturns = [
      { data: null, error: { message: "Proposals error" } },
    ];

    const result = await listServiceRequests({
      ...baseParams,
      hasProposals: true,
    });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Proposals error");
  });

  it("returns empty result when hasProposals=true but no proposals found", async () => {
    terminalReturns = [
      { data: [], error: null },
    ];

    const result = await listServiceRequests({
      ...baseParams,
      hasProposals: true,
    });
    expect(result.data?.items).toEqual([]);
    expect(result.data?.total_count).toBe(0);
  });

  it("returns data when focused serviceRequestId is provided", async () => {
    const items = [{ id: "sr-focused" }];
    terminalReturns = [{ data: items, error: null, count: 1 }];

    const result = await listServiceRequests({
      ...baseParams,
      statusTabId: "dispute",
      serviceRequestId: "sr-focused",
    });
    expect(result.data?.items).toEqual(items);
  });

  it("applies search and advanced filters when not focused", async () => {
    const items: unknown[] = [];
    terminalReturns = [{ data: items, error: null, count: 0 }];

    const result = await listServiceRequests({
      ...baseParams,
      search: "  pintura  ",
      categoryId: " Eletricista ",
      cityName: " Florianópolis ",
      neighborhoodName: " Centro ",
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
      hasImages: true,
    });
    expect(result.error).toBeNull();
  });

  it("applies hasImages false filter", async () => {
    terminalReturns = [{ data: [], error: null, count: 0 }];
    const result = await listServiceRequests({
      ...baseParams,
      hasImages: false,
    });
    expect(result.error).toBeNull();
  });


  it("hasProposals false excludes ids that have proposals", async () => {
    terminalReturns = [
      { data: [{ service_request_id: "sr-with", status: "draft" }], error: null },
      { data: [{ id: "sr-other" }], error: null, count: 1 },
    ];
    const result = await listServiceRequests({
      ...baseParams,
      hasProposals: false,
    });
    expect(result.error).toBeNull();
  });

  it("applies in_progress filter by COMPLETED SR and non-terminal service", async () => {
    const chain = makeQueryChain();
    fromMock.mockReturnValue(chain as never);
    terminalReturns = [{ data: [], error: null, count: 0 }];

    const result = await listServiceRequests({ ...baseParams, statusTabId: "in_progress" });
    expect(result.error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith("status", "COMPLETED");
    expect(chain.neq).toHaveBeenCalledWith("services.status", "COMPLETED");
    expect(chain.neq).toHaveBeenCalledWith("services.status", "CANCELLED");
  });

  it("applies completed filter by COMPLETED SR and COMPLETED service", async () => {
    const chain = makeQueryChain();
    fromMock.mockReturnValue(chain as never);
    terminalReturns = [{ data: [], error: null, count: 0 }];

    const result = await listServiceRequests({ ...baseParams, statusTabId: "completed" });
    expect(result.error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith("status", "COMPLETED");
    expect(chain.eq).toHaveBeenCalledWith("services.status", "COMPLETED");
  });

  it("resolves cancelled tab ids via RPC and filters with in()", async () => {
    const chain = makeQueryChain();
    fromMock.mockReturnValue(chain as never);
    rpcMock.mockResolvedValue({ data: ["sr-cancelled-1"], error: null } as never);
    terminalReturns = [{ data: [{ id: "sr-cancelled-1" }], error: null, count: 1 }];

    const result = await listServiceRequests({ ...baseParams, statusTabId: "cancelled" });
    expect(result.error).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("client_my_services_cancelled_ids", {
      p_client_id: "client-1",
    });
    expect(chain.in).toHaveBeenCalledWith("id", ["sr-cancelled-1"]);
  });

  it("returns empty cancelled tab when RPC yields no ids", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null } as never);

    const result = await listServiceRequests({ ...baseParams, statusTabId: "cancelled" });
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([]);
    expect(result.data?.total_count).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("applies in filter when hasProposals true and proposal ids exist", async () => {
    terminalReturns = [
      { data: [{ service_request_id: "sr-1", status: "draft" }], error: null },
      { data: [{ id: "sr-1" }], error: null, count: 1 },
    ];
    const result = await listServiceRequests({
      ...baseParams,
      hasProposals: true,
    });
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([{ id: "sr-1" }]);
  });

  it("uses default status filter for unknown tab id", async () => {
    terminalReturns = [{ data: [], error: null, count: 0 }];
    const result = await listServiceRequests({
      ...baseParams,
      statusTabId: "unknown_tab" as unknown as StatusTabId,
    });
    expect(result.error).toBeNull();
  });

  it("collects proposal ids skipping rows without service_request_id", async () => {
    terminalReturns = [
      {
        data: [
          { service_request_id: null },
          { service_request_id: "sr-ok" },
          { service_request_id: "sr-sub" },
        ],
        error: null,
      },
      { data: [{ id: "sr-sub" }], error: null, count: 1 },
    ];
    const result = await listServiceRequests({
      ...baseParams,
      hasProposals: true,
    });
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([{ id: "sr-sub" }]);
  });

  it("normalizes null data and count from successful query", async () => {
    terminalReturns = [{ data: null, error: null, count: null as unknown as number }];

    const result = await listServiceRequests(baseParams);
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([]);
    expect(result.data?.total_count).toBe(0);
  });
});

describe("cancelServiceRequest", () => {
  it("returns null error on success", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null } as never);
    terminalReturns = [{ data: null, error: null }];

    const result = await cancelServiceRequest({ id: "sr-1", clientId: "client-1" });
    expect(result.error).toBeNull();
  });

  it("returns unauthorized error when user is different from clientId", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "other-user" } },
      error: null,
    } as never);

    const result = await cancelServiceRequest({ id: "sr-1", clientId: "client-1" });
    expect(result.error).toBe("Não autorizado");
  });

  it("returns unauthorized error when not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null } as never);

    const result = await cancelServiceRequest({ id: "sr-1", clientId: "client-1" });
    expect(result.error).toBe("Não autorizado");
  });

  it("returns error on DB failure", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null } as never);
    terminalReturns = [{ data: null, error: { message: "Cannot cancel" } }];

    const result = await cancelServiceRequest({ id: "sr-1", clientId: "client-1" });
    expect(result.error).toBe("Cannot cancel");
  });
});
