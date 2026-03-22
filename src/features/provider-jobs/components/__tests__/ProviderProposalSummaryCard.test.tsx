import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderProposalHistoryItem } from "../../api/providerProposals.api";
import { ProviderProposalSummaryCard } from "../ProviderProposalSummaryCard";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const historyItem: ProviderProposalHistoryItem = {
  id: "hp1",
  proposed_amount: 99,
  proposal_description: "Histórico",
  proposal_duration_value: 1,
  proposal_duration_unit: "hours",
  proposal_suggested_slots: [],
  status: "submitted",
  tax_rate: 0,
  tax_amount: 0,
  final_amount: 99,
  photos: [],
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  client_rejection_response: null,
};

const hx = vi.hoisted(() => ({ lastEnabled: false }));

vi.mock("../../hooks/useProviderProposalHistory", () => ({
  useProviderProposalHistory: (_id: string, enabled: boolean) => {
    hx.lastEnabled = enabled;
    return {
      items: enabled ? [historyItem] : [],
      isLoading: false,
      isError: false,
      errorMessage: null,
    };
  },
}));

vi.mock("../../hooks/useProviderProposalPhotoUrls", () => ({
  useProviderProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const withdrawProviderProposal = vi.fn();
vi.mock("../../api/providerProposals.api", async () => {
  const actual = await vi.importActual<typeof import("../../api/providerProposals.api")>(
    "../../api/providerProposals.api",
  );
  return {
    ...actual,
    withdrawProviderProposal: (...a: unknown[]) => withdrawProviderProposal(...a),
  };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("ProviderProposalSummaryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hx.lastEnabled = false;
    withdrawProviderProposal.mockResolvedValue({ success: true, error: null });
  });

  it("returns null when no proposal id", () => {
    const job = createMinimalJob({ provider_proposal_id: null });
    const { container } = render(
      <ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />,
      { wrapper: wrapper() },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders edit and withdraw when canEdit", async () => {
    const onEdit = vi.fn();
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 200,
      provider_tax_rate: 0.1,
      provider_tax_amount: 20,
      provider_final_amount: 180,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={onEdit} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /editar orçamento/i }));
    expect(onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /retirar orçamento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() => expect(withdrawProviderProposal).toHaveBeenCalledWith("job-1"));
  });

  it("shows error toast when withdraw does not update a row", async () => {
    withdrawProviderProposal.mockResolvedValue({ success: false, error: "Não encontrado" });
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 50,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByRole("button", { name: /retirar orçamento/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar retirada/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não encontrado"),
    );
  });

  it("loads history when accordion opens and opens details dialog", async () => {
    const job = createMinimalJob({
      provider_proposal_id: "p1",
      provider_proposal_status: "submitted",
      provider_proposed_amount: 100,
    });
    render(<ProviderProposalSummaryCard job={job} canEdit={false} onEdit={vi.fn()} />, {
      wrapper: wrapper(),
    });
    fireEvent.click(screen.getByText(/ver histórico de orçamentos/i));
    await waitFor(() => {
      expect(screen.getByText("Histórico")).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole("button", { name: /ver detalhes do orçamento/i }),
    );
    await waitFor(() => {
      expect(screen.getByText(/detalhes do orçamento/i)).toBeInTheDocument();
    });
  });
});
