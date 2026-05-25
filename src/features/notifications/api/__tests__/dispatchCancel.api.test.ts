import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelDispatch } from "../dispatchCancel.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    schema: vi.fn(() => ({
      rpc: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const rpcMock = vi.fn();
vi.mocked(supabase.schema).mockReturnValue({ rpc: rpcMock } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelDispatch", () => {
  it("calls message_dispatcher_cancel RPC", async () => {
    rpcMock.mockResolvedValue({
      data: { dispatch_id: "d1", status: "CANCELED" },
      error: null,
    });

    const { result, error } = await cancelDispatch({
      dispatchId: "d1",
      reason: "user_opt_out",
    });

    expect(error).toBeNull();
    expect(result?.status).toBe("CANCELED");
    expect(supabase.schema).toHaveBeenCalledWith("message_dispatcher");
    expect(rpcMock).toHaveBeenCalledWith("message_dispatcher_cancel", {
      p_dispatch_id: "d1",
      p_reason: "user_opt_out",
    });
  });
});
