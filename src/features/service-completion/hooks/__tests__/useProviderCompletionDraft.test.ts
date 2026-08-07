// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_VERSION_CONFLICT_CODE,
  useProviderCompletionDraft,
} from "../useProviderCompletionDraft";
import type { ServiceCompletionContext } from "../../types/completion.types";

const saveEvidenceDraft = vi.fn();
const uploadEvidenceFile = vi.fn();

vi.mock("../../api/draft.api", () => ({
  saveEvidenceDraft: (...args: unknown[]) => saveEvidenceDraft(...args),
}));

vi.mock("../../api/upload.api", () => ({
  uploadEvidenceFile: (...args: unknown[]) => uploadEvidenceFile(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function baseContext(
  overrides: Partial<ServiceCompletionContext> = {},
): ServiceCompletionContext {
  return {
    serviceRequestId: "sr-1",
    enrichment: {
      status: "READY",
      source: "ai",
      materializedAt: "2026-08-01T00:00:00Z",
      opsAttention: false,
      schemaVersion: 1,
      checklistSchema: { version: 1, blocks: [] },
    },
    contractedService: {
      id: "cs-1",
      status: "CONFIRMED",
      executedAt: null,
      completedAt: null,
      completedBy: null,
    },
    evidence: {
      phase: "draft",
      frozenAt: null,
      draftVersion: 2,
      responses: {
        crit_1: { met: true, evidence_paths: [] },
      },
      autoExecutedWithoutChecklist: false,
    },
    capabilities: {
      canMarkExecuted: true,
      canSaveDraft: true,
      canConfirmWithRating: false,
      canSubmitOptionalRating: false,
      showDisputeStub: false,
    },
    ...overrides,
  };
}

describe("useProviderCompletionDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("hydrates responses from context and debounces save", async () => {
    saveEvidenceDraft.mockResolvedValue({
      data: { contractedServiceId: "cs-1", draftVersion: 3, phase: "draft" },
      error: null,
    });

    const context = baseContext();
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      { wrapper: wrapper() },
    );

    expect(result.current.responses.crit_1?.met).toBe(true);

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "parcial",
        evidence_paths: ["a.jpg"],
      });
    });

    expect(result.current.saveState).toBe("dirty");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(saveEvidenceDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        contractedServiceId: "cs-1",
        expectedDraftVersion: 2,
      }),
    );
    expect(result.current.draftVersion).toBe(3);
  });

  it("surfaces DRAFT_VERSION_CONFLICT without silent overwrite", async () => {
    saveEvidenceDraft.mockResolvedValue({
      data: null,
      error: "DRAFT_VERSION_CONFLICT",
      errorCode: DRAFT_VERSION_CONFLICT_CODE,
    });

    const context = baseContext();
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "parcial",
        evidence_paths: ["a.jpg"],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(result.current.saveState).toBe("conflict"));
    expect(result.current.saveError).toMatch(/recarregue/i);
  });

  it("does not save when canSaveDraft is false but still keeps local edits", () => {
    const context = baseContext({
      capabilities: {
        canMarkExecuted: true,
        canSaveDraft: false,
        canConfirmWithRating: false,
        canSubmitOptionalRating: false,
        showDisputeStub: false,
      },
    });
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "faltou acabamento",
        evidence_paths: [],
      });
    });

    expect(result.current.canSave).toBe(false);
    expect(result.current.responses.crit_1?.justification).toBe("faltou acabamento");
    expect(saveEvidenceDraft).not.toHaveBeenCalled();
  });

  it("coalesces rapid edits into a single debounced save", async () => {
    saveEvidenceDraft.mockResolvedValue({
      data: { contractedServiceId: "cs-1", draftVersion: 3, phase: "draft" },
      error: null,
    });

    const context = baseContext();
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: true,
        evidence_paths: [],
      });
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "a",
        evidence_paths: [],
      });
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "ok",
        evidence_paths: ["a.jpg"],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(result.current.saveState).toBe("saved"));
    expect(saveEvidenceDraft).toHaveBeenCalledTimes(1);
    expect(saveEvidenceDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        responses: {
          crit_1: {
            met: false,
            justification: "ok",
            evidence_paths: ["a.jpg"],
          },
        },
      }),
    );
  });

  it("writes draft version into the context query cache after save", async () => {
    saveEvidenceDraft.mockResolvedValue({
      data: { contractedServiceId: "cs-1", draftVersion: 3, phase: "draft" },
      error: null,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const initial = baseContext();
    queryClient.setQueryData(
      ["service-completion", "context", "sr-1"],
      initial,
    );

    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context: initial,
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: queryClient }, children),
      },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "faltou acabamento",
        evidence_paths: ["a.jpg"],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(result.current.saveState).toBe("saved"));

    const cached = queryClient.getQueryData<ServiceCompletionContext>([
      "service-completion",
      "context",
      "sr-1",
    ]);
    expect(cached?.evidence.draftVersion).toBe(3);
    expect(cached?.evidence.responses?.crit_1?.justification).toBe(
      "faltou acabamento",
    );
  });

  it("keeps accepting local edits after a version conflict", async () => {
    saveEvidenceDraft.mockResolvedValue({
      data: null,
      error: "DRAFT_VERSION_CONFLICT",
      errorCode: DRAFT_VERSION_CONFLICT_CODE,
    });

    const context = baseContext();
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "parcial",
        evidence_paths: ["a.jpg"],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    await waitFor(() => expect(result.current.saveState).toBe("conflict"));

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: false,
        justification: "ainda dá para digitar",
        evidence_paths: ["a.jpg"],
      });
    });

    expect(result.current.responses.crit_1?.justification).toBe(
      "ainda dá para digitar",
    );
    expect(result.current.saveState).toBe("conflict");
  });

  it("rehydrates when a newer server draft version arrives while quiet", async () => {
    const { result, rerender } = renderHook(
      ({
        context,
      }: {
        context: ServiceCompletionContext;
      }) =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context,
        }),
      {
        wrapper: wrapper(),
        initialProps: { context: baseContext() },
      },
    );

    expect(result.current.draftVersion).toBe(2);

    rerender({
      context: baseContext({
        evidence: {
          phase: "draft",
          frozenAt: null,
          draftVersion: 4,
          responses: {
            crit_1: {
              met: false,
              justification: "do servidor",
              evidence_paths: [],
            },
          },
          autoExecutedWithoutChecklist: false,
        },
      }),
    });

    await waitFor(() => expect(result.current.draftVersion).toBe(4));
    expect(result.current.responses.crit_1?.justification).toBe("do servidor");
    expect(result.current.saveState).toBe("idle");
  });
});
