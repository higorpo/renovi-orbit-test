import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmServiceCompleted } from "../confirmServiceCompleted.api";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("confirmServiceCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC success payload", async () => {
    rpc.mockResolvedValue({
      data: {
        service_id: "cs-1",
        status: "COMPLETED",
        completed_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const result = await confirmServiceCompleted("cs-1");

    expect(rpc).toHaveBeenCalledWith("payment_confirm_service_completed", {
      p_service_id: "cs-1",
    });
    expect(result).toEqual({
      data: {
        serviceId: "cs-1",
        status: "COMPLETED",
        completedAt: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
  });

  it("maps RPC error code to user-facing message", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "fallback",
        details: '{"code":"SERVICE_NOT_EXECUTED"}',
      },
    });

    const result = await confirmServiceCompleted("cs-1");

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("SERVICE_NOT_EXECUTED");
    expect(result.error).toBeTruthy();
  });
});
