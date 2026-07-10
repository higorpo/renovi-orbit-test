import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordProviderOpportunityView } from "../opportunityView.api";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe("recordProviderOpportunityView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls record_provider_opportunity_view RPC", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    const result = await recordProviderOpportunityView("sr-1");

    expect(rpcMock).toHaveBeenCalledWith("record_provider_opportunity_view", {
      p_service_request_id: "sr-1",
    });
    expect(result).toEqual({ data: { success: true }, error: null });
  });

  it("returns error when RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "forbidden" } });

    const result = await recordProviderOpportunityView("sr-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("forbidden");
  });

  it("rejects blank opportunity ids", async () => {
    const result = await recordProviderOpportunityView("   ");

    expect(result).toEqual({
      data: null,
      error: "ID da oportunidade é obrigatório",
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("treats missing success flag as successful", async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });

    const result = await recordProviderOpportunityView("sr-1");

    expect(result).toEqual({ data: { success: true }, error: null });
  });
});
