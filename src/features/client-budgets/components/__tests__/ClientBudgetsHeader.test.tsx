import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientBudgetsHeader } from "../ClientBudgetsHeader";

describe("ClientBudgetsHeader", () => {
  it("hides summary row while loading", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={2}
        isLoading
      />,
    );
    expect(
      screen.queryByText(/2 serviços com orçamento aguardando aprovação/),
    ).not.toBeInTheDocument();
  });

  it("shows singular pending-approval line", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={1}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/1 serviço com orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });

  it("shows plural pending-approval line", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={5}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/5 serviços com orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });

  it("shows error copy when pending approval count failed", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={0}
        isLoading={false}
        pendingApprovalCountError
      />,
    );
    expect(screen.getByText(/— serviços \(indisponível\)/)).toBeInTheDocument();
  });
});
