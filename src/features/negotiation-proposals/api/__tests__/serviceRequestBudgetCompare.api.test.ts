import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchServiceRequestBudgetCompareDetail,
  rejectServiceRequestBudgetProposal,
} from "../serviceRequestBudgetCompare.api";

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

describe("fetchServiceRequestBudgetCompareDetail", () => {
  it("returns detail data on success", async () => {
    const detail = { service_request: { title: "Job" }, budgets: [] };
    rpcMock.mockResolvedValue({ data: detail, error: null });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toEqual(detail);
    expect(result.error).toBeNull();
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const result = await fetchServiceRequestBudgetCompareDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Not found");
  });
});

describe("rejectServiceRequestBudgetProposal", () => {
  it("returns data on success", async () => {
    rpcMock.mockResolvedValue({ data: { status: "rejected" }, error: null });

    const result = await rejectServiceRequestBudgetProposal({
      proposalId: "prop-1",
      reason: "Too expensive",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ status: "rejected" });
  });
});
