import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetsHeader } from "../BudgetsHeader";

describe("BudgetsHeader", () => {
  it("hides summary row while loading", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={3}
        isLoading
      />,
    );
    expect(
      screen.queryByText(/3 orçamentos aguardando aprovação/),
    ).not.toBeInTheDocument();
  });

  it("shows pending-approval budget line with singular wording", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={1}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/1 orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });

  it("shows plural orçamentos aguardando aprovação", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={4}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/4 orçamentos aguardando aprovação/)).toBeInTheDocument();
  });
});
