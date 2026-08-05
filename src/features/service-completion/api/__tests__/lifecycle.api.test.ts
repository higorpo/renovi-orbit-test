import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmServiceCompleted, markServiceExecuted } from "../lifecycle.api";
import { logger } from "@/lib/logger";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("markServiceExecuted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls service_completion_mark_executed with checklist payload", async () => {
    mockRpc.mockResolvedValue({
      data: {
        contracted_service_id: "svc-1",
        status: "EXECUTED",
        executed_at: "2026-08-01T16:00:00.000Z",
        executed_late: false,
        evidence_id: "ev-1",
        idempotent: false,
      },
      error: null,
    });

    const result = await markServiceExecuted({
      contractedServiceId: "svc-1",
      responses: { c1: { met: true } },
      idempotencyKey: "idem-1",
    });

    expect(mockRpc).toHaveBeenCalledWith("service_completion_mark_executed", {
      p_contracted_service_id: "svc-1",
      p_responses: { c1: { met: true } },
      p_idempotency_key: "idem-1",
      p_expected_draft_version: null,
    });
    expect(result).toEqual({
      data: {
        contractedServiceId: "svc-1",
        status: "EXECUTED",
        executedAt: "2026-08-01T16:00:00.000Z",
        executedLate: false,
        evidenceId: "ev-1",
        idempotent: false,
      },
      error: null,
    });
  });

  it("rejects empty checklist payload without calling RPC", async () => {
    const result = await markServiceExecuted({
      contractedServiceId: "svc-1",
      responses: {},
      idempotencyKey: "idem-empty",
    });

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.errorCode).toBe("CHECKLIST_PAYLOAD_REQUIRED");
    expect(result.data).toBeNull();
  });

  it("maps SERVICE_NOT_YET_DUE to scheduled-date user message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "SERVICE_NOT_YET_DUE",
        details: JSON.stringify({ code: "SERVICE_NOT_YET_DUE" }),
      },
    });

    const result = await markServiceExecuted({
      contractedServiceId: "svc-early",
      responses: { c1: { met: true } },
      idempotencyKey: "idem-early",
    });

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("SERVICE_NOT_YET_DUE");
    expect(result.error).toContain("data agendada");
    expect(logger.warn).toHaveBeenCalledWith(
      "service_completion_mark_executed_failed",
      expect.objectContaining({
        feature: "service_completion",
        outcome: "mark_executed",
        contracted_service_id: "svc-early",
        errorCode: "SERVICE_NOT_YET_DUE",
      }),
    );
  });

  it("falls back to error.message when details have no code", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "INVALID_STATUS_TRANSITION",
      },
    });

    const result = await markServiceExecuted({
      contractedServiceId: "svc-bad-status",
      responses: { c1: { met: true } },
      idempotencyKey: "idem-bad",
    });

    expect(result.errorCode).toBe("INVALID_STATUS_TRANSITION");
    expect(result.error).toContain("Não é possível atualizar o status");
  });
});

describe("confirmServiceCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls service_completion_confirm_with_rating with scores", async () => {
    mockRpc.mockResolvedValue({
      data: {
        contracted_service_id: "svc-2",
        status: "COMPLETED",
        completed_at: "2026-08-02T12:00:00.000Z",
        rating_id: "r-1",
        overall_score: 4.5,
        idempotent: false,
      },
      error: null,
    });

    const result = await confirmServiceCompleted({
      contractedServiceId: "svc-2",
      scores: {
        quality: 5,
        punctuality: 4,
        communication: 5,
        value: 4,
        comment: " bom ",
      },
      idempotencyKey: "idem-confirm",
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "service_completion_confirm_with_rating",
      {
        p_contracted_service_id: "svc-2",
        p_score_quality: 5,
        p_score_punctuality: 4,
        p_score_communication: 5,
        p_score_value: 4,
        p_comment: "bom",
        p_idempotency_key: "idem-confirm",
      },
    );
    expect(result).toEqual({
      data: {
        contractedServiceId: "svc-2",
        status: "COMPLETED",
        completedAt: "2026-08-02T12:00:00.000Z",
        ratingId: "r-1",
        overallScore: 4.5,
        idempotent: false,
      },
      error: null,
    });
  });

  it("rejects out-of-range scores before RPC", async () => {
    const result = await confirmServiceCompleted({
      contractedServiceId: "svc-2",
      scores: {
        quality: 6,
        punctuality: 5,
        communication: 5,
        value: 5,
      },
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.errorCode).toBe("RATING_SCORES_OUT_OF_RANGE");
  });

  it("maps DISPUTE_OPEN to dispute-resolution user message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "DISPUTE_OPEN",
        details: JSON.stringify({ code: "DISPUTE_OPEN" }),
      },
    });

    const result = await confirmServiceCompleted({
      contractedServiceId: "svc-disputed",
      scores: {
        quality: 5,
        punctuality: 5,
        communication: 5,
        value: 5,
      },
    });

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("DISPUTE_OPEN");
    expect(result.error).toContain("disputa");
  });

  it("maps unknown codes to generic fallback message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "SOME_UNKNOWN_CODE",
        details: JSON.stringify({ code: "SOME_UNKNOWN_CODE" }),
      },
    });

    const result = await confirmServiceCompleted({
      contractedServiceId: "svc-unknown",
      scores: {
        quality: 5,
        punctuality: 5,
        communication: 5,
        value: 5,
      },
    });

    expect(result.errorCode).toBe("SOME_UNKNOWN_CODE");
    expect(result.error).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
