import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetsEmptyState } from "../BudgetsEmptyState";

describe("BudgetsEmptyState", () => {
  it("shows filter empty state with clear action", () => {
    const onClear = vi.fn();
    render(
      <BudgetsEmptyState
        hasFilters
        onClearFilters={onClear}
      />,
    );
    expect(screen.getByText(/nenhum resultado encontrado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows default empty copy without filters", () => {
    render(
      <BudgetsEmptyState hasFilters={false} />,
    );
    expect(
      screen.getByText(/você ainda não enviou nenhum orçamento/i),
    ).toBeInTheDocument();
  });
});
