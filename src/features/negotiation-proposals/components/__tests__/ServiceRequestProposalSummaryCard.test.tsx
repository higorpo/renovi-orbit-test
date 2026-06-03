import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceRequestProposalSummary } from "../../types/serviceRequestProposal.types";
import type { ProviderProposalHistoryItem } from "../../types/proposals.types";
import { ServiceRequestProposalSummaryCard } from "../ServiceRequestProposalSummaryCard";

const historyItem: ProviderProposalHistoryItem = {
  id: "hist-1",
  proposed_amount: 800,
  proposal_description: "Histórico",
  proposal_duration_value: 1,
  proposal_duration_unit: "hours",
  proposal_suggested_slots: [],
  status: "REVISED",
  tax_rate: 0.1,
  tax_amount: 80,
  final_amount: 720,
  photos: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  client_rejection_response: null,
  revision_reason: null,
  revision_notes: null,
};

const historyState = vi.hoisted(() => ({
  items: [] as ProviderProposalHistoryItem[],
  isLoading: false,
  isError: false,
}));

vi.mock("../../hooks/useProposalHistory", () => ({
  useProposalHistory: (_id: string, enabled: boolean) => ({
    items: enabled ? historyState.items : [],
    isLoading: historyState.isLoading,
    isError: historyState.isError,
    errorMessage: historyState.isError ? "fail" : null,
  }),
}));

vi.mock("../../hooks/useProposalPhotoUrls", () => ({
  useProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

const baseSummary: ServiceRequestProposalSummary = {
  serviceRequestId: "sr-1",
  proposalId: "prop-1",
  isLatestProposal: true,
  status: "PENDING",
  proposedAmount: 500,
  taxRate: 0.1,
  taxAmount: 50,
  description: "Descrição do serviço",
  photos: null,
  clientRejectionResponse: null,
  revisionReason: null,
  revisionNotes: null,
};

describe("ServiceRequestProposalSummaryCard", () => {
  beforeEach(() => {
    historyState.items = [];
    historyState.isLoading = false;
    historyState.isError = false;
  });

  it("renders latest proposal summary", () => {
    render(
      <ServiceRequestProposalSummaryCard summary={baseSummary} canEdit={false} onEdit={vi.fn()} />,
    );
    expect(screen.getByText(/seu orçamento mais recente/i)).toBeInTheDocument();
    expect(screen.getByText(/descrição do serviço/i)).toBeInTheDocument();
  });

  it("shows edit action when canEdit", () => {
    render(
      <ServiceRequestProposalSummaryCard summary={baseSummary} canEdit onEdit={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /editar orçamento/i })).toBeInTheDocument();
  });

  it("calls onEdit when edit is clicked", () => {
    const onEdit = vi.fn();
    render(
      <ServiceRequestProposalSummaryCard summary={baseSummary} canEdit onEdit={onEdit} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /editar orçamento/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("shows revision request details when client requested revision", () => {
    render(
      <ServiceRequestProposalSummaryCard
        summary={{
          ...baseSummary,
          status: "REVISION_REQUESTED",
          revisionReason: "PRICE_TOO_HIGH",
          revisionNotes: "Valor acima do orçamento previsto",
        }}
        canEdit={false}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/revisão solicitada pelo cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/preço alto/i)).toBeInTheDocument();
    expect(screen.getByText(/valor acima do orçamento previsto/i)).toBeInTheDocument();
  });

  it("shows rejection response when rejected", () => {
    render(
      <ServiceRequestProposalSummaryCard
        summary={{
          ...baseSummary,
          status: "REJECTED",
          clientRejectionResponse: "Preço alto",
        }}
        canEdit={false}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/preço alto/i)).toBeInTheDocument();
  });

  it("loads history when accordion opens", () => {
    historyState.items = [historyItem];
    render(
      <ServiceRequestProposalSummaryCard summary={baseSummary} canEdit={false} onEdit={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(/ver histórico de orçamentos/i));
    expect(screen.getByText("Histórico")).toBeInTheDocument();
  });
});
