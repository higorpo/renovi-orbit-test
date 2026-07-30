import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmServiceCompleted, markServiceExecuted } from "../serviceLifecycle.api";
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

  it("maps RPC success to camelCase service execution payload", async () => {
    mockRpc.mockResolvedValue({
      data: {
        service_id: "svc-1",
        status: "EXECUTED",
        executed_at: "2026-08-01T16:00:00.000Z",
      },
      error: null,
    });

    const result = await markServiceExecuted("svc-1");

    expect(mockRpc).toHaveBeenCalledWith("payment_mark_service_executed", {
      p_service_id: "svc-1",
    });
    expect(result).toEqual({
      data: {
        serviceId: "svc-1",
        status: "EXECUTED",
        executedAt: "2026-08-01T16:00:00.000Z",
      },
      error: null,
    });
  });

  it("maps SERVICE_NOT_YET_DUE to scheduled-date user message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "SERVICE_NOT_YET_DUE",
        details: JSON.stringify({ code: "SERVICE_NOT_YET_DUE" }),
      },
    });

    const result = await markServiceExecuted("svc-early");

    expect(result.data).toBeNull();
    expect(result.errorCode).toBe("SERVICE_NOT_YET_DUE");
    expect(result.error).toContain("data agendada");
    expect(logger.warn).toHaveBeenCalledWith(
      "payment_mark_service_executed_failed",
      expect.objectContaining({
        contractedServiceId: "svc-early",
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

    const result = await markServiceExecuted("svc-bad-status");

    expect(result.errorCode).toBe("INVALID_STATUS_TRANSITION");
    expect(result.error).toContain("Não é possível atualizar o status");
  });
});

describe("confirmServiceCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC success to camelCase completion payload", async () => {
    mockRpc.mockResolvedValue({
      data: {
        service_id: "svc-2",
        status: "COMPLETED",
        completed_at: "2026-08-02T12:00:00.000Z",
      },
      error: null,
    });

    const result = await confirmServiceCompleted("svc-2");

    expect(mockRpc).toHaveBeenCalledWith("payment_confirm_service_completed", {
      p_service_id: "svc-2",
    });
    expect(result).toEqual({
      data: {
        serviceId: "svc-2",
        status: "COMPLETED",
        completedAt: "2026-08-02T12:00:00.000Z",
      },
      error: null,
    });
  });

  it("maps DISPUTE_OPEN to dispute-resolution user message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "DISPUTE_OPEN",
        details: JSON.stringify({ code: "DISPUTE_OPEN" }),
      },
    });

    const result = await confirmServiceCompleted("svc-disputed");

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

    const result = await confirmServiceCompleted("svc-unknown");

    expect(result.errorCode).toBe("SOME_UNKNOWN_CODE");
    expect(result.error).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });

  it("maps SERVICE_NOT_FOUND_OR_UNAUTHORIZED to permission message", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "SERVICE_NOT_FOUND_OR_UNAUTHORIZED",
        details: JSON.stringify({ code: "SERVICE_NOT_FOUND_OR_UNAUTHORIZED" }),
      },
    });

    const result = await confirmServiceCompleted("svc-missing");

    expect(result.errorCode).toBe("SERVICE_NOT_FOUND_OR_UNAUTHORIZED");
    expect(result.error).toContain("não encontrado");
  });
});
