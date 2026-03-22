import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetsEmptyState } from "../BudgetsEmptyState";

describe("BudgetsEmptyState", () => {
  it("shows filter empty state with clear action", () => {
    const onClear = vi.fn();
    render(
      <BudgetsEmptyState
        tab="enviados"
        hasFilters
        onClearFilters={onClear}
      />,
    );
    expect(screen.getByText(/nenhum resultado encontrado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows default empty copy for enviados without filters", () => {
    render(
      <BudgetsEmptyState tab="enviados" hasFilters={false} />,
    );
    expect(
      screen.getByText(/você ainda não enviou nenhum orçamento/i),
    ).toBeInTheDocument();
  });

  it("shows default empty copy for perguntas without filters", () => {
    render(
      <BudgetsEmptyState tab="perguntas" hasFilters={false} />,
    );
    expect(
      screen.getByText(/você ainda não enviou nenhuma pergunta/i),
    ).toBeInTheDocument();
  });
});
