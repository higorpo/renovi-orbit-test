import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useProviderJobQuestionComposer } from "../useProviderJobQuestionComposer";
import * as providerJobQuestionsApi from "../../api/providerJobQuestions.api";

const { mockInvalidateQueries } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("../../api/providerJobQuestions.api", () => ({
  createProviderJobQuestion: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const createProviderJobQuestion = vi.mocked(providerJobQuestionsApi.createProviderJobQuestion);

describe("useProviderJobQuestionComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens with prefilled suggested question", () => {
    const { result } = renderHook(() => useProviderJobQuestionComposer("sr-1"));

    act(() => {
      result.current.openComposer({
        prefilledQuestion: "O local possui acesso fácil?",
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.questionDraft).toBe("O local possui acesso fácil?");
  });

  it("sends question and resets state on success", async () => {
    createProviderJobQuestion.mockResolvedValue({
      data: { id: "q-1", created_at: "2026-03-19T10:00:00.000Z" },
      error: null,
    });
    const { result } = renderHook(() => useProviderJobQuestionComposer("sr-1"));

    act(() => {
      result.current.openComposer();
      result.current.setQuestionDraft("Há tomada próxima ao local?");
    });

    await act(async () => {
      await result.current.submitQuestion();
    });

    expect(createProviderJobQuestion).toHaveBeenCalledWith({
      serviceRequestId: "sr-1",
      question: "Há tomada próxima ao local?",
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["provider-job-questions", "sr-1"],
      refetchType: "active",
    });
    expect(toast.success).toHaveBeenCalledWith("Pergunta enviada com sucesso.");
    expect(result.current.isOpen).toBe(false);
    expect(result.current.questionDraft).toBe("");
  });

  it("does not submit empty question", async () => {
    const { result } = renderHook(() => useProviderJobQuestionComposer("sr-1"));

    act(() => {
      result.current.openComposer();
      result.current.setQuestionDraft("   ");
    });

    await act(async () => {
      await result.current.submitQuestion();
    });

    expect(createProviderJobQuestion).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Escreva uma pergunta antes de enviar.");
  });
});
