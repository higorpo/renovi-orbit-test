// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderExecutedWizard } from "../ProviderExecutedWizard";
import type { ServiceCompletionContext } from "../../types/completion.types";

const contextState: {
  current: ServiceCompletionContext | null;
  isLoading: boolean;
  isError: boolean;
} = {
  current: null,
  isLoading: true,
  isError: false,
};

vi.mock("../../hooks/useServiceCompletionContext", () => ({
  useServiceCompletionContext: () => ({
    data: contextState.current,
    isLoading: contextState.isLoading,
    isError: contextState.isError,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/useProviderCompletionDraft", () => ({
  useProviderCompletionDraft: () => ({
    responses: {},
    draftVersion: 1,
    saveState: "idle",
    saveError: null,
    uploadingCriterionId: null,
    setCriterionResponse: vi.fn(),
    uploadEvidenceForCriterion: vi.fn(),
    reloadFromServer: vi.fn(),
  }),
}));

vi.mock("../../hooks/useProviderMarkExecuted", () => ({
  useProviderMarkExecuted: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function baseContext(): ServiceCompletionContext {
  return {
    serviceRequestId: "sr-1",
    enrichment: {
      status: "READY",
      source: "ai",
      materializedAt: null,
      opsAttention: false,
      schemaVersion: 1,
      checklistSchema: {
        version: 1,
        blocks: [
          {
            id: "c1",
            type: "completion_criterion",
            label: "Serviço finalizado?",
            required: true,
            config: { requires_evidence_when_met: true },
          },
        ],
      },
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
      draftVersion: 1,
      responses: {},
      autoExecutedWithoutChecklist: false,
    },
    capabilities: {
      canMarkExecuted: true,
      canSaveDraft: true,
      canConfirmWithRating: false,
      canSubmitOptionalRating: false,
      showDisputeStub: false,
    },
  };
}

describe("ProviderExecutedWizard", () => {
  beforeEach(() => {
    contextState.current = null;
    contextState.isLoading = true;
    contextState.isError = false;
  });

  it("shows checklist-shaped skeleton while loading", () => {
    render(<ProviderExecutedWizard serviceRequestId="sr-1" />, { wrapper });

    expect(
      screen.getByTestId("provider-executed-wizard-loading"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Carregando checklist"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId("provider-executed-criterion-skeleton"),
    ).toHaveLength(3);
    expect(
      screen.getByTestId("provider-executed-footer-skeleton"),
    ).toBeInTheDocument();
  });

  it("shows skeleton when context is missing without error", () => {
    contextState.isLoading = false;
    contextState.current = null;
    contextState.isError = false;

    render(<ProviderExecutedWizard serviceRequestId="sr-1" />, { wrapper });

    expect(
      screen.getByTestId("provider-executed-wizard-loading"),
    ).toBeInTheDocument();
  });

  it("renders checklist after load", () => {
    contextState.isLoading = false;
    contextState.current = baseContext();

    render(<ProviderExecutedWizard serviceRequestId="sr-1" />, { wrapper });

    expect(
      screen.queryByTestId("provider-executed-wizard-loading"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("provider-executed-wizard")).toBeInTheDocument();
    expect(screen.getByText("Serviço finalizado?")).toBeInTheDocument();
    expect(
      screen.getByTestId("provider-mark-executed-submit"),
    ).toBeInTheDocument();
  });
});
