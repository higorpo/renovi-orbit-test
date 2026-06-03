import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetsFilterChips } from "../BudgetsFilterChips";

describe("BudgetsFilterChips", () => {
  it("renders budget status chips", () => {
    const onBudget = vi.fn();
    render(
      <BudgetsFilterChips
        budgetStatusFilter="submitted"
        searchQuery=""
        onBudgetStatusChange={onBudget}
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^aceitos$/i }));
    expect(onBudget).toHaveBeenCalledWith("accepted");
  });

  it("updates search input", () => {
    const onSearch = vi.fn();
    render(
      <BudgetsFilterChips
        budgetStatusFilter="submitted"
        searchQuery="hi"
        onBudgetStatusChange={vi.fn()}
        onSearchChange={onSearch}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "nova" },
    });
    expect(onSearch).toHaveBeenCalledWith("nova");
  });

  it("disables controls when disabled", () => {
    render(
      <BudgetsFilterChips
        budgetStatusFilter="submitted"
        searchQuery=""
        onBudgetStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByPlaceholderText(/buscar/i)).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^aguardando$/i })).toBeDisabled();
  });
});
