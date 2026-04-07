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

  it("shows error copy when pending approval count failed", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={0}
        pendingQuestionsCount={0}
        isLoading={false}
        pendingApprovalCountError
      />,
    );
    expect(screen.getByText(/— serviços \(indisponível\)/)).toBeInTheDocument();
  });

  it("shows error copy when pending questions count failed", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={0}
        pendingQuestionsCount={0}
        isLoading={false}
        pendingQuestionsCountError
      />,
    );
    expect(screen.getByText(/— perguntas \(indisponível\)/)).toBeInTheDocument();
  });

  it("pluralizes pending questions summary", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={0}
        pendingQuestionsCount={3}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/3 perguntas pendente/)).toBeInTheDocument();
  });

  it("uses singular pending question label when count is 1", () => {
    render(
      <ClientBudgetsHeader
        pendingApprovalServiceCount={0}
        pendingQuestionsCount={1}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/1 pergunta pendente/)).toBeInTheDocument();
  });
});
