import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientPendingEvaluationPrompt } from "../pendingEvaluationPrompt.api";
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

describe("getClientPendingEvaluationPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC payload to camelCase prompt", async () => {
    mockRpc.mockResolvedValue({
      data: {
        service_request_id: "sr-1",
        contracted_service_id: "cs-1",
        executed_at: "2026-08-06T12:00:00.000Z",
        title: "Pintura",
        category_title: "Pintura",
        provider_full_name: "Ana Silva",
        scheduled_start_date: "2026-08-05",
        scheduled_end_date: "2026-08-06",
        icon_key: "Wind",
        color_key: "sky_indigo",
      },
      error: null,
    });

    const result = await getClientPendingEvaluationPrompt();

    expect(mockRpc).toHaveBeenCalledWith("get_client_pending_evaluation_prompt");
    expect(result).toEqual({
      data: {
        serviceRequestId: "sr-1",
        contractedServiceId: "cs-1",
        executedAt: "2026-08-06T12:00:00.000Z",
        title: "Pintura",
        categoryTitle: "Pintura",
        providerFullName: "Ana Silva",
        scheduledStartDate: "2026-08-05",
        scheduledEndDate: "2026-08-06",
        iconKey: "Wind",
        colorKey: "sky_indigo",
      },
      error: null,
    });
  });

  it("returns null data when RPC returns null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(getClientPendingEvaluationPrompt()).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it("logs and returns error message on RPC failure", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    const result = await getClientPendingEvaluationPrompt();

    expect(result).toEqual({ data: null, error: "permission denied" });
    expect(logger.warn).toHaveBeenCalledWith(
      "get_client_pending_evaluation_prompt_failed",
      expect.objectContaining({ error: "permission denied" }),
    );
  });

  it("returns null when payload lacks required ids", async () => {
    mockRpc.mockResolvedValue({
      data: { title: "orphan" },
      error: null,
    });

    await expect(getClientPendingEvaluationPrompt()).resolves.toEqual({
      data: null,
      error: null,
    });
  });
});
