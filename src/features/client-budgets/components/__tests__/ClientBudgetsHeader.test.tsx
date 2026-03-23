import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientBudgetsHeader } from "../ClientBudgetsHeader";

describe("ClientBudgetsHeader", () => {
  it("hides summary row while loading", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={2}
        pendingQuestionsCount={1}
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
        pendingQuestionsCount={0}
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
        pendingQuestionsCount={0}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/5 serviços com orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });
});
