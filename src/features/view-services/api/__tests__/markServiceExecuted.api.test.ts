import { beforeEach, describe, expect, it, vi } from "vitest";
import { markServiceExecuted } from "../markServiceExecuted.api";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("markServiceExecuted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC success payload", async () => {
    rpc.mockResolvedValue({
      data: {
        service_id: "cs-1",
        status: "EXECUTED",
        executed_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const result = await markServiceExecuted("cs-1");

    expect(rpc).toHaveBeenCalledWith("payment_mark_service_executed", {
      p_service_id: "cs-1",
    });
    expect(result).toEqual({
      data: {
        serviceId: "cs-1",
        status: "EXECUTED",
        executedAt: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
  });

  it("maps RPC error code to user-facing message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "fallback",
        details: '{"code":"SERVICE_NOT_CONFIRMED"}',
      },
    });

    const result = await markServiceExecuted("cs-1");

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("SERVICE_NOT_CONFIRMED");
    expect(result.error).toBeTruthy();
  });
});
