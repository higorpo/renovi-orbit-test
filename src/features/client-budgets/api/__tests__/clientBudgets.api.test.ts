import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchClientReceivedBudgets,
  fetchClientBudgetDetail,
  rejectClientBudgetProposal,
} from "../clientBudgets.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const rpcMock = vi.fn();
const { supabase } = await import("@/lib/supabase/client");
(supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc = rpcMock;

beforeEach(() => {
  vi.clearAllMocks();
});

function paginatedResponse<T>(items: T[] = []) {
  return { items, total_count: items.length, page: 1, page_size: 10 };
}

describe("fetchClientReceivedBudgets", () => {
  it("returns paginated data on success", async () => {
    const payload = paginatedResponse([{ id: "budget-1" }]);
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toEqual(payload);
    expect(result.error).toBeNull();
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "RPC error" } });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toBeNull();
    expect(result.error).toBe("RPC error");
  });

  it("returns error when response is not paginated", async () => {
    rpcMock.mockResolvedValue({ data: { wrong: "shape" }, error: null });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("fetchClientBudgetDetail", () => {
  it("returns detail data on success", async () => {
    const detail = { id: "req-1", services: [] };
    rpcMock.mockResolvedValue({ data: detail, error: null });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toEqual(detail);
    expect(result.error).toBeNull();
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Not found");
  });

  it("returns error when response is null or not an object", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("rejectClientBudgetProposal", () => {
  it("returns data on success", async () => {
    rpcMock.mockResolvedValue({ data: { status: "rejected" }, error: null });

    const result = await rejectClientBudgetProposal({
      proposalId: "prop-1",
      reason: "Too expensive",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ status: "rejected" });
    expect(rpcMock).toHaveBeenCalledWith("reject_client_budget_proposal", {
      p_proposal_id: "prop-1",
      p_reason: "Too expensive",
    });
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Cannot reject" } });

    const result = await rejectClientBudgetProposal({
      proposalId: "prop-1",
      reason: "No",
    });
    expect(result.error).toBe("Cannot reject");
  });
});
