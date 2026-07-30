import { describe, it, expect, vi, beforeEach } from "vitest";
import { issueClearSaleSession } from "../clearsale.api";
import { PAYMENT_RPC } from "../payments.rpc";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

describe("issueClearSaleSession", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("issues an accept session via RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        session_id: "11111111-1111-4111-8111-111111111111",
        expires_at: "2099-01-01T00:00:00Z",
        purpose: "accept",
      },
      error: null,
    });

    const result = await issueClearSaleSession({
      purpose: "accept",
      proposalId: "proposal-1",
    });

    expect(result.error).toBeNull();
    expect(result.sessionId).toBe("11111111-1111-4111-8111-111111111111");
    expect(mockRpc).toHaveBeenCalledWith(PAYMENT_RPC.issueClearSaleSession, {
      p_purpose: "accept",
      p_proposal_id: "proposal-1",
      p_schedule_id: null,
    });
  });

  it("returns error when RPC fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "CLEARSALE_SESSION_FORBIDDEN" },
    });

    const result = await issueClearSaleSession({
      purpose: "manual",
      scheduleId: "schedule-1",
    });

    expect(result.sessionId).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("rejects non-object or empty session payloads as invalid", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    const nullPayload = await issueClearSaleSession({
      purpose: "accept",
      proposalId: "proposal-1",
    });
    expect(nullPayload.sessionId).toBeNull();
    expect(nullPayload.error).toBeTruthy();

    mockRpc.mockResolvedValue({
      data: { session_id: "", expires_at: "2099-01-01T00:00:00Z", purpose: "accept" },
      error: null,
    });

    const emptySession = await issueClearSaleSession({
      purpose: "accept",
      proposalId: "proposal-1",
    });
    expect(emptySession.sessionId).toBeNull();
    expect(emptySession.error).toBeTruthy();
  });
});
