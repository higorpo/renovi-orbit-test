// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfirmRatingWizard } from "../ClientConfirmRatingWizard";
import type { ServiceCompletionContext } from "../../types/completion.types";

const confirmServiceCompleted = vi.fn();
const submitServiceRating = vi.fn();

const contextState: { current: ServiceCompletionContext | null } = {
  current: null,
};

vi.mock("../../api/lifecycle.api", () => ({
  confirmServiceCompleted: (...args: unknown[]) =>
    confirmServiceCompleted(...args),
}));

vi.mock("../../api/ratings.api", () => ({
  submitServiceRating: (...args: unknown[]) => submitServiceRating(...args),
}));

vi.mock("../../hooks/useServiceCompletionContext", () => ({
  useServiceCompletionContext: () => ({
    data: contextState.current,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function baseContext(
  caps: Partial<ServiceCompletionContext["capabilities"]>,
): ServiceCompletionContext {
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
            label: "Feito?",
            required: true,
            config: { requires_evidence_when_met: false },
          },
        ],
      },
    },
    contractedService: {
      id: "cs-1",
      status: "EXECUTED",
      executedAt: "2026-08-04T12:00:00Z",
      completedAt: null,
      completedBy: null,
    },
    evidence: {
      phase: "frozen",
      executedLate: true,
      frozenAt: "2026-08-04T12:00:00Z",
      draftVersion: null,
      responses: {
        c1: { met: true, evidence_paths: [] },
      },
    },
    capabilities: {
      canMarkExecuted: false,
      canSaveDraft: false,
      canConfirmWithRating: false,
      canSubmitOptionalRating: false,
      showDisputeStub: false,
      ...caps,
    },
  };
}

describe("ClientConfirmRatingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextState.current = null;
  });

  it("hides when capabilities and status do not allow confirm, optional rating, or dispute", () => {
    contextState.current = baseContext({});
    contextState.current.contractedService.status = "CONFIRMED";
    const { container } = render(
      <ClientConfirmRatingWizard serviceRequestId="sr-1" />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("keeps Continuar para avaliação disabled until execution confirmation is checked", () => {
    contextState.current = baseContext({ canConfirmWithRating: true });
    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

    const continueBtn = screen.getByTestId("client-confirm-continue-rating");
    expect(continueBtn).toBeDisabled();

    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );
    expect(continueBtn).toBeEnabled();
  });

  it("blocks confirm submit when scores are missing", async () => {
    contextState.current = baseContext({ canConfirmWithRating: true });
    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

    expect(screen.getByTestId("executed-late-badge")).toBeInTheDocument();
    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );
    fireEvent.click(screen.getByTestId("client-confirm-continue-rating"));
    fireEvent.click(screen.getByTestId("client-confirm-submit"));

    expect(await screen.findByTestId("client-rating-score-error")).toHaveTextContent(
      /quatro notas/i,
    );
    expect(confirmServiceCompleted).not.toHaveBeenCalled();
  });

  it("submits confirm_with_rating after all scores selected", async () => {
    contextState.current = baseContext({ canConfirmWithRating: true });
    confirmServiceCompleted.mockResolvedValue({
      data: {
        contractedServiceId: "cs-1",
        status: "COMPLETED",
        completedAt: "2026-08-04T13:00:00Z",
        ratingId: "r-1",
        overallScore: 5,
        idempotent: false,
      },
      error: null,
    });

    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });
    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );
    fireEvent.click(screen.getByTestId("client-confirm-continue-rating"));

    for (const name of ["quality", "punctuality", "communication", "value"]) {
      const group = screen.getByTestId(`score-dimension-${name}`);
      fireEvent.click(group.querySelector('[aria-label="5 de 5"]')!);
    }

    fireEvent.click(screen.getByTestId("client-confirm-submit"));

    await waitFor(() =>
      expect(confirmServiceCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          contractedServiceId: "cs-1",
          scores: expect.objectContaining({
            quality: 5,
            punctuality: 5,
            communication: 5,
            value: 5,
          }),
        }),
      ),
    );
  });

  it("uses submit_service_rating for optional post-auto-complete path", async () => {
    contextState.current = baseContext({
      canSubmitOptionalRating: true,
    });
    contextState.current.contractedService.status = "COMPLETED";
    contextState.current.contractedService.completedBy = "system";
    submitServiceRating.mockResolvedValue({
      ratingId: "r-2",
      overallScore: 4,
      error: null,
    });

    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });
    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );
    fireEvent.click(screen.getByTestId("client-confirm-continue-rating"));

    for (const name of ["quality", "punctuality", "communication", "value"]) {
      const group = screen.getByTestId(`score-dimension-${name}`);
      fireEvent.click(group.querySelector('[aria-label="4 de 5"]')!);
    }

    fireEvent.click(screen.getByTestId("client-confirm-submit"));

    await waitFor(() =>
      expect(submitServiceRating).toHaveBeenCalledWith(
        "cs-1",
        expect.objectContaining({ quality: 4, value: 4 }),
      ),
    );
    expect(confirmServiceCompleted).not.toHaveBeenCalled();
  });
});
