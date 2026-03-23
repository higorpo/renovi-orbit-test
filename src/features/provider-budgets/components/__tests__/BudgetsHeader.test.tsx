import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetsHeader } from "../BudgetsHeader";

describe("BudgetsHeader", () => {
  it("hides summary row while loading", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={3}
        pendingQuestionsCount={2}
        isLoading
      />,
    );
    expect(
      screen.queryByText(/3 orçamentos aguardando aprovação/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/2 perguntas aguardando resposta/)).not.toBeInTheDocument();
  });

  it("shows pending-approval budget line with singular wording", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={1}
        pendingQuestionsCount={0}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/1 orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });

  it("shows singular pending question line", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={0}
        pendingQuestionsCount={1}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/1 pergunta aguardando resposta/),
    ).toBeInTheDocument();
  });

  it("shows plural orçamentos aguardando aprovação and pending questions banner", () => {
    render(
      <BudgetsHeader
        pendingApprovalBudgetCount={4}
        pendingQuestionsCount={2}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/4 orçamentos aguardando aprovação/)).toBeInTheDocument();
    expect(screen.getByText(/2 perguntas aguardando resposta/)).toBeInTheDocument();
  });
});
