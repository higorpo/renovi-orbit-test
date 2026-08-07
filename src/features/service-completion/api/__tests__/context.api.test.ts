import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getServiceCompletionContext,
  mapServiceCompletionContextRpc,
} from "../context.api";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

describe("mapServiceCompletionContextRpc", () => {
  it("maps snake_case RPC payload to camelCase domain model", () => {
    const mapped = mapServiceCompletionContextRpc(
      {
        service_request_id: "sr-1",
        enrichment: {
          status: "READY",
          source: "ai",
          materialized_at: "2026-01-01T00:00:00Z",
          ops_attention: false,
          schema_version: 1,
          checklist_schema: { version: 1, blocks: [] },
        },
        contracted_service: {
          id: "cs-1",
          status: "CONFIRMED",
          executed_at: null,
          completed_at: null,
          completed_by: null,
        },
        evidence: {
          phase: "draft",
          frozen_at: null,
          draft_version: 2,
          responses: { c1: { met: true, evidence_paths: [] } },
          auto_executed_without_checklist: false,
        },
        capabilities: {
          can_mark_executed: true,
          can_save_draft: true,
          can_confirm_with_rating: false,
          can_submit_optional_rating: false,
          show_dispute_stub: false,
        },
      },
      "sr-fallback",
    );

    expect(mapped.serviceRequestId).toBe("sr-1");
    expect(mapped.enrichment?.status).toBe("READY");
    expect(mapped.enrichment?.checklistSchema).toEqual({ version: 1, blocks: [] });
    expect(mapped.evidence.draftVersion).toBe(2);
    expect(mapped.evidence.autoExecutedWithoutChecklist).toBe(false);
    expect(mapped.capabilities.canMarkExecuted).toBe(true);
  });

  it("maps auto_executed_without_checklist flag", () => {
    const mapped = mapServiceCompletionContextRpc(
      {
        evidence: {
          phase: "frozen",
          auto_executed_without_checklist: true,
          responses: {},
        },
        contracted_service: { id: "cs-1", status: "EXECUTED" },
        capabilities: {},
      },
      "sr-1",
    );

    expect(mapped.evidence.autoExecutedWithoutChecklist).toBe(true);
  });
});

describe("getServiceCompletionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls get_service_completion_context RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        service_request_id: "sr-1",
        enrichment: { status: "PENDING", ops_attention: false },
        contracted_service: { id: null, status: null },
        evidence: { phase: "absent" },
        capabilities: {},
      },
      error: null,
    });

    const result = await getServiceCompletionContext("sr-1");

    expect(rpc).toHaveBeenCalledWith("get_service_completion_context", {
      p_service_request_id: "sr-1",
    });
    expect(result.error).toBeNull();
    expect(result.data?.enrichment?.status).toBe("PENDING");
  });

  it("returns error message on RPC failure", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Service not found or access denied" },
    });

    const result = await getServiceCompletionContext("sr-x");
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/access denied/i);
  });
});
