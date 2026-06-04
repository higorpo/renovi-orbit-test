import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReceivedBudgetDetailsSheet } from "../ReceivedBudgetDetailsSheet";
import * as detailHook from "../../hooks/useServiceRequestBudgetCompareDetail";
import type {
  ServiceRequestBudgetCompareDetail,
  ServiceRequestBudgetCompareProposal,
} from "../../types/serviceRequestBudgetCompare.types";

vi.mock("../../hooks/useServiceRequestBudgetCompareDetail", () => ({
  useServiceRequestBudgetCompareDetail: vi.fn(),
}));

vi.mock("@/features/provider-profile", () => ({
  ProviderProfileInlinePreview: () => <div data-testid="profile-preview" />,
}));

vi.mock("../ServiceRequestBudgetCompareVersionBlock", () => ({
  ServiceRequestBudgetCompareVersionBlock: () => <div data-testid="current-proposal" />,
}));

function renderReceivedSheet(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(createElement(QueryClientProvider, { client }, ui) as ReactElement);
}

const proposal: ServiceRequestBudgetCompareProposal = {
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
};

const detailBase: ServiceRequestBudgetCompareDetail = {
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
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReset();
  });

  it("shows loading skeleton", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
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

  it("shows compare title and service request title when loaded", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
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
    expect(screen.getByRole("heading", { name: /Comparar orçamentos/i })).toBeInTheDocument();
    expect(screen.getByText("Meu pedido")).toBeInTheDocument();
    expect(screen.getByTestId("current-proposal")).toBeInTheDocument();
  });

  it("shows history title in history mode", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
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
    expect(screen.getByRole("heading", { name: /Histórico de orçamentos/i })).toBeInTheDocument();
  });

  it("shows empty state when no budgets", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
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

  it("enables reject button in compare mode for submitted proposal", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
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
    const rejectBtn = screen.getByRole("button", { name: /Recusar orçamento/i });
    expect(rejectBtn).not.toBeDisabled();
    fireEvent.click(rejectBtn);
    expect(screen.getByRole("heading", { name: /Recusar orçamento/i })).toBeInTheDocument();
  });
});
