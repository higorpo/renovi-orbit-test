// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalCountdownBanner } from "../ProposalCountdownBanner";

describe("ProposalCountdownBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("shows client warning copy in compact mode from expires_at", () => {
    render(
      <ProposalCountdownBanner
        status="PENDING"
        expiresAt="2026-01-01T03:00:00.000Z"
        audience="client"
        density="compact"
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Prazo para responder")).toBeInTheDocument();
    expect(screen.getByText(/Restam 3 h/i)).toBeInTheDocument();
  });

  it("falls back to submitted_at plus default SLA when expires_at is missing", () => {
    render(
      <ProposalCountdownBanner
        status="PENDING"
        submittedAt="2026-01-01T00:00:00.000Z"
        audience="provider"
      />,
    );

    expect(screen.getByText("Aguardando resposta do cliente")).toBeInTheDocument();
    expect(screen.getByText(/O cliente tem 1 dia/i)).toBeInTheDocument();
  });

  it("renders nothing when countdown is inactive", () => {
    render(
      <ProposalCountdownBanner
        status="ACCEPTED"
        expiresAt="2026-01-02T00:00:00.000Z"
        audience="client"
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
