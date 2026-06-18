import { beforeEach, describe, expect, it, vi } from "vitest";
import { dismissProviderOpportunity } from "../dismissOpportunity.api";

const rpcMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("dismissProviderOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls dismiss_provider_opportunity RPC", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    const result = await dismissProviderOpportunity("sr-1");

    expect(rpcMock).toHaveBeenCalledWith("dismiss_provider_opportunity", {
      p_service_request_id: "sr-1",
    });
    expect(result).toEqual({ data: { success: true }, error: null });
  });

  it("returns error when RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "forbidden" } });

    const result = await dismissProviderOpportunity("sr-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("forbidden");
  });

  it("rejects empty service request id", async () => {
    const result = await dismissProviderOpportunity("  ");

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.error).toMatch(/obrigatório/i);
  });
});
