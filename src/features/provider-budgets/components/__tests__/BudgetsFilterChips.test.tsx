import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BudgetsFilterChips } from "../BudgetsFilterChips";

describe("BudgetsFilterChips", () => {
  it("renders budget status chips on enviados tab", () => {
    const onBudget = vi.fn();
    render(
      <BudgetsFilterChips
        activeTab="enviados"
        budgetStatusFilter="submitted"
        questionStatusFilter="pending"
        searchQuery=""
        onBudgetStatusChange={onBudget}
        onQuestionStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^aceitos$/i }));
    expect(onBudget).toHaveBeenCalledWith("accepted");
  });

  it("renders question status chips on perguntas tab", () => {
    const onQuestion = vi.fn();
    render(
      <BudgetsFilterChips
        activeTab="perguntas"
        budgetStatusFilter="submitted"
        questionStatusFilter="pending"
        searchQuery=""
        onBudgetStatusChange={vi.fn()}
        onQuestionStatusChange={onQuestion}
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^respondidas$/i }));
    expect(onQuestion).toHaveBeenCalledWith("answered");
  });

  it("updates search input", () => {
    const onSearch = vi.fn();
    render(
      <BudgetsFilterChips
        activeTab="enviados"
        budgetStatusFilter="submitted"
        questionStatusFilter="pending"
        searchQuery="hi"
        onBudgetStatusChange={vi.fn()}
        onQuestionStatusChange={vi.fn()}
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
        activeTab="enviados"
        budgetStatusFilter="submitted"
        questionStatusFilter="pending"
        searchQuery=""
        onBudgetStatusChange={vi.fn()}
        onQuestionStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByPlaceholderText(/buscar/i)).toBeDisabled();
    expect(screen.getByRole("tab", { name: /^aguardando$/i })).toBeDisabled();
  });
});
