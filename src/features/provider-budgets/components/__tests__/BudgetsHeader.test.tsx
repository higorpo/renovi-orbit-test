import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetsHeader } from "../BudgetsHeader";

describe("BudgetsHeader", () => {
  it("hides summary row while loading", () => {
    render(
      <BudgetsHeader budgetCount={3} pendingQuestionsCount={2} isLoading />,
    );
    expect(screen.queryByText("3 orçamentos")).not.toBeInTheDocument();
    expect(screen.queryByText(/2 perguntas aguardando resposta/)).not.toBeInTheDocument();
  });

  it("shows budget count with pluralization", () => {
    render(
      <BudgetsHeader budgetCount={1} pendingQuestionsCount={0} isLoading={false} />,
    );
    expect(screen.getByText(/1 orçamento(?!s)/)).toBeInTheDocument();
  });

  it("shows singular pending question line", () => {
    render(
      <BudgetsHeader budgetCount={0} pendingQuestionsCount={1} isLoading={false} />,
    );
    expect(
      screen.getByText(/1 pergunta aguardando resposta/),
    ).toBeInTheDocument();
  });

  it("shows plural orçamentos and pending questions banner", () => {
    render(
      <BudgetsHeader budgetCount={4} pendingQuestionsCount={2} isLoading={false} />,
    );
    expect(screen.getByText(/4 orçamentos/)).toBeInTheDocument();
    expect(screen.getByText(/2 perguntas aguardando resposta/)).toBeInTheDocument();
  });
});
