// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderMarkExecutedAction } from "../ProviderMarkExecutedAction";
import { ClientEvaluateServiceAction } from "../ClientEvaluateServiceAction";
import type { ServiceCompletionContext } from "../../types/completion.types";

const contextState: { current: ServiceCompletionContext | null } = {
  current: null,
};

vi.mock("../../hooks/useServiceCompletionContext", () => ({
  useServiceCompletionContext: () => ({
    data: contextState.current,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("../ProviderExecutedWizard", () => ({
  ProviderExecutedWizard: () => <div data-testid="provider-executed-wizard" />,
}));

vi.mock("../ClientConfirmRatingWizard", () => ({
  ClientConfirmRatingWizard: () => (
    <div data-testid="client-confirm-rating-wizard" />
  ),
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
      executedLate: false,
      frozenAt: null,
      draftVersion: 1,
      responses: {},
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

describe("completion action CTAs", () => {
  beforeEach(() => {
    contextState.current = null;
  });

  it("opens provider mark-executed dialog when capable", () => {
    contextState.current = baseContext({
      canSaveDraft: true,
      canMarkExecuted: true,
    });
    render(<ProviderMarkExecutedAction serviceRequestId="sr-1" />, { wrapper });

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar serviço como concluído/i }),
    );
    expect(screen.getByTestId("provider-mark-executed-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("provider-executed-wizard")).toBeInTheDocument();
  });

  it("hides provider CTA when not capable", () => {
    contextState.current = baseContext({});
    const { container } = render(
      <ProviderMarkExecutedAction serviceRequestId="sr-1" />,
      { wrapper },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens client evaluate dialog when capable", () => {
    contextState.current = baseContext({
      canConfirmWithRating: true,
    });
    contextState.current.contractedService.status = "EXECUTED";
    render(<ClientEvaluateServiceAction serviceRequestId="sr-1" />, { wrapper });

    fireEvent.click(screen.getByRole("button", { name: /Avaliar serviço/i }));
    expect(screen.getByTestId("client-evaluate-service-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("client-confirm-rating-wizard")).toBeInTheDocument();
  });
});
