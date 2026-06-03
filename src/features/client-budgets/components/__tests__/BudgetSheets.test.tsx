import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReceivedBudgetDetailsSheet } from "../ReceivedBudgetDetailsSheet";
import * as detailHook from "../../hooks/useClientBudgetDetail";
import type { ClientBudgetDetail, ClientBudgetDetailProposal } from "../../types/client-budgets.types";

vi.mock("../../hooks/useClientBudgetDetail", () => ({
  useClientBudgetDetail: vi.fn(),
}));

vi.mock("@/features/provider-profile", () => ({
  ProviderProfileInlinePreview: () => <div data-testid="profile-preview" />,
}));

vi.mock("../CurrentProposalVersionBlock", () => ({
  CurrentProposalVersionBlock: () => <div data-testid="current-proposal" />,
}));

function renderReceivedSheet(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(createElement(QueryClientProvider, { client }, ui) as ReactElement);
}

const proposal: ClientBudgetDetailProposal = {
  id: "bp1",
  provider_id: "pr1",
  provider_name: "Prestador",
  provider_slug: "prest",
  provider_profile_image_path: null,
  proposed_amount: 500,
  status: "submitted",
  created_at: "2024-01-01T00:00:00Z",
  proposal_description: "Desc",
  photos: [],
  client_response_deadline_at: null,
};

const detailBase: ClientBudgetDetail = {
  service_request: {
    id: "sr1",
    title: "Meu pedido",
    description: null,
    status: "open",
    created_at: "2024-01-01T00:00:00Z",
    service_title: "S",
    service_slug: "s",
    service_icon_key: null,
    service_color_key: null,
    neighborhood: null,
    city: null,
    state_abbr: null,
  },
  budgets: [proposal],
};

describe("ReceivedBudgetDetailsSheet", () => {
  beforeEach(() => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReset();
  });

  it("shows loading skeleton", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Carregando detalhes do orçamento/i)).toBeInTheDocument();
  });

  it("shows empty alert in compare mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: { ...detailBase, budgets: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Nenhum orçamento encontrado/i)).toBeInTheDocument();
  });

  it("renders provider block when budgets exist", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="history"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("profile-preview")).toBeInTheDocument();
    expect(screen.getByTestId("current-proposal")).toBeInTheDocument();
  });

  it("renders history subsection when provider has multiple versions", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        budgets: [
          proposal,
          { ...proposal, id: "bp2", proposed_amount: 300, status: "REVISED" as const },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Histórico/i)).toBeInTheDocument();
  });

  it("shows history copy when sheet mode is history and empty", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: { ...detailBase, budgets: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="history"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/registrados/i)).toBeInTheDocument();
  });

  it("opens reject reason dialog from compare mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Recusar orçamento/i }));
    expect(screen.getByRole("dialog", { name: /Recusar orçamento/i })).toBeInTheDocument();
  });

  it("disables reject in history mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="history"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Recusar orçamento/i })).toBeDisabled();
  });

  it("shows load error and calls refetch on retry", () => {
    const refetch = vi.fn();
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Não foi possível carregar os detalhes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("disables reject in compare mode when latest proposal is not submitted", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        budgets: [{ ...proposal, status: "accepted" as const }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Recusar orçamento/i })).toBeDisabled();
  });
});
