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
      executedLate: null,
      frozenAt: null,
      draftVersion: 2,
      responses: {
        crit_1: { met: true, evidence_paths: [] },
      },
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

    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context: baseContext(),
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
      await vi.advanceTimersByTimeAsync(900);
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

    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context: baseContext(),
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: true,
        evidence_paths: [],
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    await waitFor(() => expect(result.current.saveState).toBe("conflict"));
    expect(result.current.saveError).toMatch(/recarregue/i);
  });

  it("does not save when canSaveDraft is false", () => {
    const { result } = renderHook(
      () =>
        useProviderCompletionDraft({
          serviceRequestId: "sr-1",
          context: baseContext({
            capabilities: {
              canMarkExecuted: false,
              canSaveDraft: false,
              canConfirmWithRating: false,
              canSubmitOptionalRating: false,
              showDisputeStub: false,
            },
          }),
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.setCriterionResponse("crit_1", {
        met: true,
        evidence_paths: [],
      });
    });

    expect(result.current.canSave).toBe(false);
    expect(saveEvidenceDraft).not.toHaveBeenCalled();
  });
});
