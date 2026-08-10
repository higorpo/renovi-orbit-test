// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OpenDisputeEntry,
  shouldShowOpenDispute,
} from "../OpenDisputeEntry";

const mutateAsync = vi.fn();

vi.mock("../../hooks/useOpenDispute", () => ({
  useOpenDispute: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("shouldShowOpenDispute", () => {
  it("shows for canOpenDispute, legacy stub capability, or EXECUTED", () => {
    expect(shouldShowOpenDispute({ canOpenDispute: true })).toBe(true);
    expect(shouldShowOpenDispute({ showDisputeStubCapability: true })).toBe(
      true,
    );
    expect(shouldShowOpenDispute({ csStatus: "EXECUTED" })).toBe(true);
    expect(shouldShowOpenDispute({ csStatus: "COMPLETED" })).toBe(false);
    expect(shouldShowOpenDispute({ csStatus: "IN_DISPUTE" })).toBe(false);
    expect(shouldShowOpenDispute({ csStatus: "CONFIRMED" })).toBe(false);
  });
});

describe("OpenDisputeEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({ status: "IN_DISPUTE" });
  });

  it("renders Abrir disputa copy and opens confirm dialog", () => {
    render(
      <OpenDisputeEntry
        serviceRequestId="sr-1"
        contractedServiceId="cs-1"
      />,
      { wrapper },
    );

    expect(screen.getByTestId("open-dispute-entry")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Se você acha que há algo errado na execução do serviço com base no checklist evidenciado acima/i,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-dispute-cta"));
    expect(screen.getByTestId("open-dispute-confirm-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("open-dispute-reason")).toBeInTheDocument();
  });

  it("uses copy without checklist reference when auto-executed without checklist", () => {
    render(
      <OpenDisputeEntry
        serviceRequestId="sr-1"
        contractedServiceId="cs-1"
        autoExecutedWithoutChecklist
      />,
      { wrapper },
    );

    expect(
      screen.getByText(
        /Se você acha que há algo errado na execução do serviço, ou se algo não foi cumprido corretamente/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/checklist evidenciado acima/i),
    ).not.toBeInTheDocument();
  });

  it("submits optional reason via confirm action", async () => {
    render(
      <OpenDisputeEntry
        serviceRequestId="sr-1"
        contractedServiceId="cs-1"
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("open-dispute-cta"));
    fireEvent.change(screen.getByTestId("open-dispute-reason"), {
      target: { value: "Serviço incompleto" },
    });
    fireEvent.click(screen.getByTestId("open-dispute-confirm"));

    expect(mutateAsync).toHaveBeenCalledWith({
      reason: "Serviço incompleto",
    });
  });

  it("delegates to onRequestOpen without embedding confirm dialog", () => {
    const onRequestOpen = vi.fn();
    render(
      <OpenDisputeEntry
        serviceRequestId="sr-1"
        contractedServiceId="cs-1"
        onRequestOpen={onRequestOpen}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("open-dispute-cta"));
    expect(onRequestOpen).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId("open-dispute-confirm-dialog"),
    ).not.toBeInTheDocument();
  });
});
