import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BudgetStatusBadge } from "../BudgetStatusBadge";
import { ClientBudgetsEmptyState } from "../ClientBudgetsEmptyState";
import { ClientBudgetsErrorState } from "../ClientBudgetsErrorState";
import { BudgetPreviewRow } from "../BudgetPreviewRow";
import type { BudgetPreviewItem } from "../../types/client-budgets.types";

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: "https://img.example/avatar.png" }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "há 2 dias",
}));

const budget: BudgetPreviewItem = {
  id: "b1",
  provider_id: "p1",
  provider_name: "João Silva",
  provider_slug: "joao",
  provider_profile_image_path: "pub/joao.jpg",
  proposed_amount: 1500.5,
  status: "submitted",
  created_at: "2024-06-01T12:00:00Z",
};

describe("ClientBudgets presentational components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("BudgetStatusBadge renders label from status config", () => {
    render(<BudgetStatusBadge status="accepted" />);
    expect(screen.getByText("Aceito")).toBeInTheDocument();
  });

  it("ClientBudgetsEmptyState shows filter empty state", () => {
    const onClear = vi.fn();
    render(
      <ClientBudgetsEmptyState hasFilters onClearFilters={onClear} />,
    );
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it("ClientBudgetsEmptyState shows default copy without filters", () => {
    render(<ClientBudgetsEmptyState hasFilters={false} />);
    expect(screen.getByText(/Nenhum orçamento recebido ainda/i)).toBeInTheDocument();
  });

  it("ClientBudgetsErrorState wires retry", () => {
    const onRetry = vi.fn();
    render(<ClientBudgetsErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("BudgetPreviewRow shows provider, amount and status", () => {
    render(<BudgetPreviewRow budget={budget} />);
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText(/1\.500,50/)).toBeInTheDocument();
    expect(screen.getByText(/Aguardando avaliação/i)).toBeInTheDocument();
  });
});
