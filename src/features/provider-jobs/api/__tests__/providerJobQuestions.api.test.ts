import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProviderJobQuestion,
  listProviderJobQuestions,
} from "../providerJobQuestions.api";

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

  it("returns fallback when rpc returns null data without error", async () => {
    rpc.mockResolvedValue({
      data: null,
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

describe("listProviderJobQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list when rpc succeeds", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          id: "q-1",
          question: "Pergunta",
          client_response: "Resposta",
          client_response_images: [],
          created_at: "2026-03-19T10:00:00.000Z",
          client_responded_at: "2026-03-19T11:00:00.000Z",
          is_own_question: false,
          provider_first_name: "João",
        },
      ],
      error: null,
    } as never);

    const result = await listProviderJobQuestions("sr-1");

    expect(rpc).toHaveBeenCalledWith("list_provider_service_request_questions", {
      p_service_request_id: "sr-1",
    });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it("returns error message when rpc fails", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Forbidden" },
    } as never);

    const result = await listProviderJobQuestions("sr-1");

    expect(result).toEqual({
      data: null,
      error: "Forbidden",
    });
  });

  it("returns fallback when rpc payload is not an array", async () => {
    rpc.mockResolvedValue({
      data: { rows: [] },
      error: null,
    } as never);

    const result = await listProviderJobQuestions("sr-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
    expect(logger.error).toHaveBeenCalledWith(
      "list_provider_job_questions_invalid_response",
      expect.objectContaining({ serviceRequestId: "sr-1" }),
    );
  });
});
