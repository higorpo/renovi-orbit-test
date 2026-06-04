// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalCountdownBanner } from "../ProposalCountdownBanner";

vi.mock("../../api/platformConstants.api", () => ({
  getProposalResponseSlaHours: vi.fn().mockResolvedValue(24),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("ProposalCountdownBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("shows client warning copy in compact mode", () => {
    render(
      <ProposalCountdownBanner
        status="PENDING"
        submittedAt="2025-12-31T03:00:00.000Z"
        audience="client"
        density="compact"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Prazo para responder")).toBeInTheDocument();
    expect(screen.getByText(/Restam 3 h/i)).toBeInTheDocument();
  });

  it("shows provider copy in default mode", () => {
    render(
      <ProposalCountdownBanner
        status="PENDING"
        submittedAt="2026-01-01T00:00:00.000Z"
        audience="provider"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Aguardando resposta do cliente")).toBeInTheDocument();
    expect(screen.getByText(/O cliente tem 1 dia/i)).toBeInTheDocument();
  });

  it("renders nothing when countdown is inactive", () => {
    render(
      <ProposalCountdownBanner
        status="ACCEPTED"
        submittedAt="2026-01-01T00:00:00.000Z"
        audience="client"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
