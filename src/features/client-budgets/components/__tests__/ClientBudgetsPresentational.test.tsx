import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BudgetStatusBadge } from "../BudgetStatusBadge";
import { QuestionStatusBadge } from "../QuestionStatusBadge";
import { ClientBudgetsEmptyState } from "../ClientBudgetsEmptyState";
import { ClientBudgetsErrorState } from "../ClientBudgetsErrorState";
import { BudgetPreviewRow } from "../BudgetPreviewRow";
import { QuestionPreviewRow } from "../QuestionPreviewRow";
import type { BudgetPreviewItem, QuestionPreviewItem } from "../../types/client-budgets.types";

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

const question: QuestionPreviewItem = {
  id: "q1",
  provider_id: "p1",
  provider_name: "Maria",
  provider_slug: "maria",
  provider_profile_image_path: null,
  question: "Pode no sábado?",
  client_response: null,
  client_response_images: [],
  created_at: "2024-06-02T12:00:00Z",
  client_responded_at: null,
};

describe("ClientBudgets presentational components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("BudgetStatusBadge renders label from status config", () => {
    render(<BudgetStatusBadge status="accepted" />);
    expect(screen.getByText("Aceito")).toBeInTheDocument();
  });

  it("QuestionStatusBadge maps response state", () => {
    const { rerender } = render(
      <QuestionStatusBadge clientResponse={null} clientRespondedAt={null} />,
    );
    expect(screen.getByText("Não respondida")).toBeInTheDocument();

    rerender(
      <QuestionStatusBadge
        clientResponse="Sim"
        clientRespondedAt="2024-01-01"
        serviceRequestStatus={null}
      />,
    );
    expect(screen.getByText("Respondida")).toBeInTheDocument();
  });

  it("ClientBudgetsEmptyState shows filter empty state", () => {
    const onClear = vi.fn();
    render(
      <ClientBudgetsEmptyState tab="recebidos" hasFilters onClearFilters={onClear} />,
    );
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: /Limpar filtros/i });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it("ClientBudgetsEmptyState shows tab-specific copy without filters", () => {
    const { rerender } = render(<ClientBudgetsEmptyState tab="recebidos" hasFilters={false} />);
    expect(screen.getByText(/Nenhum orçamento recebido ainda/i)).toBeInTheDocument();

    rerender(<ClientBudgetsEmptyState tab="perguntas" hasFilters={false} />);
    expect(screen.getByText(/Nenhuma pergunta recebida ainda/i)).toBeInTheDocument();
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

  it("QuestionPreviewRow shows question text and provider", () => {
    render(<QuestionPreviewRow question={question} />);
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Pode no sábado?")).toBeInTheDocument();
  });
});
