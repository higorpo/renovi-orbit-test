// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientConfirmRatingWizard } from "../ClientConfirmRatingWizard";
import type { ServiceCompletionContext } from "../../types/completion.types";

const confirmServiceCompleted = vi.fn();
const submitServiceRating = vi.fn();

const declarationOverride: {
  forceError: string | null;
  forcePersisted: boolean | null;
} = {
  forceError: null,
  forcePersisted: null,
};

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

vi.mock("../../hooks/useClientExecutionDeclaration", async () => {
  const React = await import("react");
  return {
    useClientExecutionDeclaration: () => {
      const [checked, setChecked] = React.useState(false);
      const [declarationPersisted, setDeclarationPersisted] = React.useState(
        false,
      );
      return {
        checked,
        setChecked: (next: boolean) => {
          setChecked(next);
          if (declarationOverride.forceError) {
            setDeclarationPersisted(false);
            return;
          }
          if (declarationOverride.forcePersisted === false) {
            setDeclarationPersisted(false);
            return;
          }
          setDeclarationPersisted(next);
        },
        declarationPersisted:
          declarationOverride.forcePersisted === false
            ? false
            : declarationPersisted,
        isPersisting: false,
        error: declarationOverride.forceError,
      };
    },
  };
});

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
      frozenAt: "2026-08-04T12:00:00Z",
      draftVersion: null,
      responses: {
        c1: { met: true, evidence_paths: [] },
      },
      autoExecutedWithoutChecklist: false,
    },
    capabilities: {
      canMarkExecuted: false,
      canSaveDraft: false,
      canConfirmWithRating: false,
      canSubmitOptionalRating: false,
      canOpenDispute: false,
      isInDispute: false,
      showDisputeStub: false,
      ...caps,
    },
  };
}

describe("ClientConfirmRatingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextState.current = null;
    declarationOverride.forceError = null;
    declarationOverride.forcePersisted = null;
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

  it("keeps Continuar para avaliação disabled until declaration is checked and persisted", () => {
    contextState.current = baseContext({ canConfirmWithRating: true });
    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

    const continueBtn = screen.getByTestId("client-confirm-continue-rating");
    expect(continueBtn).toBeDisabled();

    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );
    expect(screen.getByTestId("client-confirm-continue-rating")).toBeEnabled();
  });

  it("keeps Continuar disabled and shows inline error when declaration persist fails", () => {
    declarationOverride.forceError =
      "Não foi possível registrar sua declaração. Remarque a caixa para tentar novamente.";
    declarationOverride.forcePersisted = false;
    contextState.current = baseContext({ canConfirmWithRating: true });

    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

    fireEvent.click(
      screen.getByTestId("client-confirm-execution-acknowledged"),
    );

    expect(screen.getByTestId("client-confirm-continue-rating")).toBeDisabled();
    expect(
      screen.getByTestId("client-confirm-execution-ack-error"),
    ).toHaveTextContent(/declaração/i);
  });

  it("blocks confirm submit when scores are missing", async () => {
    contextState.current = baseContext({ canConfirmWithRating: true });
    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

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

  it("shows auto-executed-without-checklist alert and softens ack copy", () => {
    contextState.current = baseContext({
      canConfirmWithRating: true,
    });
    contextState.current.evidence.autoExecutedWithoutChecklist = true;
    contextState.current.evidence.responses = {};

    render(<ClientConfirmRatingWizard serviceRequestId="sr-1" />, { wrapper });

    expect(
      screen.getByTestId("auto-executed-without-checklist-alert"),
    ).toHaveTextContent(/sem o checklist/i);
    expect(screen.getByTestId("client-confirm-execution-ack")).toHaveTextContent(
      /Declaro que o serviço foi executado corretamente/i,
    );
    expect(
      screen.queryByText(/revisei as evidências acima/i),
    ).not.toBeInTheDocument();
  });

  it("optional post-auto-complete opens on rating only — no checklist, ack, or dispute", async () => {
    const onStepChange = vi.fn();
    contextState.current = baseContext({
      canSubmitOptionalRating: true,
      canOpenDispute: false,
      showDisputeStub: false,
    });
    contextState.current.contractedService.status = "COMPLETED";
    contextState.current.contractedService.completedBy = "system";
    submitServiceRating.mockResolvedValue({
      ratingId: "r-2",
      overallScore: 4,
      error: null,
    });

    render(
      <ClientConfirmRatingWizard
        serviceRequestId="sr-1"
        onStepChange={onStepChange}
      />,
      { wrapper },
    );

    const wizard = screen.getByTestId("client-confirm-rating-wizard");
    expect(wizard).toHaveAttribute("data-step", "rating");
    expect(
      screen.queryByTestId("client-confirm-continue-rating"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("client-confirm-execution-ack"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("open-dispute-entry")).not.toBeInTheDocument();
    expect(screen.queryByText(/Feito\?/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Voltar/i }),
    ).not.toBeInTheDocument();
    expect(onStepChange).toHaveBeenCalledWith("rating", "");

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
