import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProviderJobQuestion } from "../providerJobQuestions.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const supabase = await import("@/lib/supabase/client").then((m) => m.supabase);
const rpc = vi.mocked(supabase.rpc);
const logger = await import("@/lib/logger").then((m) => m.logger);

describe("createProviderJobQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns payload when rpc succeeds", async () => {
    rpc.mockResolvedValue({
      data: { id: "q-1", created_at: "2026-03-19T10:00:00.000Z" },
      error: null,
    } as never);

    const result = await createProviderJobQuestion({
      serviceRequestId: "sr-1",
      question: "O local já tem material disponível?",
    });

    expect(rpc).toHaveBeenCalledWith("create_provider_service_request_question", {
      p_service_request_id: "sr-1",
      p_question: "O local já tem material disponível?",
    });
    expect(result).toEqual({
      data: { id: "q-1", created_at: "2026-03-19T10:00:00.000Z" },
      error: null,
    });
  });

  it("returns error message when rpc fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Only providers can ask questions" },
    } as never);

    const result = await createProviderJobQuestion({
      serviceRequestId: "sr-1",
      question: "Pergunta",
    });

    expect(result).toEqual({
      data: null,
      error: "Only providers can ask questions",
    });
  });

  it("returns fallback error when rpc payload shape is invalid", async () => {
    rpc.mockResolvedValue({
      data: [{ id: "q-1", created_at: "2026-03-19T10:00:00.000Z" }],
      error: null,
    } as never);

    const result = await createProviderJobQuestion({
      serviceRequestId: "sr-1",
      question: "Pergunta",
    });

    expect(result).toEqual({
      data: null,
      error: "Unexpected response from server",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "create_provider_job_question_invalid_response",
      expect.objectContaining({ serviceRequestId: "sr-1" }),
    );
  });
});
