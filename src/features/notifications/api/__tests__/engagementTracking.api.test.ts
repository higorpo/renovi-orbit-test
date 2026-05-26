import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordPushClick } from "../engagementTracking.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    schema: vi.fn(() => ({
      rpc: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const { logger } = await import("@/lib/logger");
const rpcMock = vi.fn();
vi.mocked(supabase.schema).mockReturnValue({ rpc: rpcMock } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordPushClick", () => {
  it("calls message_dispatcher_record_push_click RPC with correct params", async () => {
    rpcMock.mockResolvedValue({
      data: { applied: true, first_engagement: true },
      error: null,
    });

    const result = await recordPushClick({
      dispatchId: "d1",
      metadata: { source: "test" },
    });

    expect(result).toEqual({ applied: true, firstEngagement: true });
    expect(supabase.schema).toHaveBeenCalledWith("message_dispatcher");
    expect(rpcMock).toHaveBeenCalledWith(
      "message_dispatcher_record_push_click",
      {
        p_dispatch_id: "d1",
        p_metadata: { source: "test" },
      },
    );
  });

  it("defaults metadata to empty object when omitted", async () => {
    rpcMock.mockResolvedValue({
      data: { applied: true, first_engagement: false },
      error: null,
    });

    await recordPushClick({ dispatchId: "d2" });

    expect(rpcMock).toHaveBeenCalledWith(
      "message_dispatcher_record_push_click",
      {
        p_dispatch_id: "d2",
        p_metadata: {},
      },
    );
  });

  it("throws and logs on RPC error", async () => {
    const rpcError = { message: "dispatch_not_found", code: "P0001" };
    rpcMock.mockResolvedValue({ data: null, error: rpcError });

    await expect(recordPushClick({ dispatchId: "bad" })).rejects.toEqual(
      rpcError,
    );

    expect(logger.error).toHaveBeenCalledWith(
      "mmd_record_push_click_rpc_error",
      {
        error: "dispatch_not_found",
        dispatchId: "bad",
      },
    );
  });

  it("returns defaults when RPC returns null data", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await recordPushClick({ dispatchId: "d3" });

    expect(result).toEqual({ applied: false, firstEngagement: false });
  });
});
