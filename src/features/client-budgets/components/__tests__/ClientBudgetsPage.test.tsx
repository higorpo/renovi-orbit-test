import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { ClientBudgetsPage } from "../ClientBudgetsPage";
import type { ClientReceivedServiceGroup } from "../../types/client-budgets.types";

vi.mock("@/features/client-my-services", () => ({
  getServiceRequestsPageUrlWithFocus: (id: string) => `/meus-servicos?focus=${id}`,
}));

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: null }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "ontem",
}));

const resetFilters = vi.fn();
const setReceivedStatusFilter = vi.fn();
const setSearchQuery = vi.fn();
const fetchNextReceived = vi.fn();
const refetchReceived = vi.fn();

const receivedItem: ClientReceivedServiceGroup = {
  service_request_id: "sr-1",
  service_request_title: "Pedido A",
  service_request_description: null,
  service_request_status: "open",
  service_request_created_at: "2024-01-01T00:00:00Z",
  service_title: "Serviço",
  service_slug: "svc",
  service_icon_key: null,
  service_color_key: null,
  neighborhood: null,
  city: null,
  state_abbr: null,
  latest_budget_at: null,
  total_budgets: 1,
  submitted_count: 1,
  accepted_count: 0,
  rejected_count: 0,
  budgets_preview: [
    {
      id: "b1",
      provider_id: "p1",
      provider_name: "Ana",
      provider_slug: "ana",
      provider_profile_image_path: null,
      proposed_amount: 100,
      status: "submitted",
      created_at: "2024-01-01T00:00:00Z",
    },
  ],
};

const filtersState = {
  hasActiveFilters: false,
};

vi.mock("../../hooks/useClientBudgetsFilters", () => ({
  useClientBudgetsFilters: () => ({
    receivedStatusFilter: "awaiting_decision" as const,
    searchQuery: "",
    setSearchQuery,
    setReceivedStatusFilter,
    receivedStatusParam: "awaiting_decision",
    searchParam: null,
    resetFilters,
    hasActiveFilters: filtersState.hasActiveFilters,
  }),
}));

const receivedState = {
  items: [receivedItem] as ClientReceivedServiceGroup[],
  totalCount: 1,
  isLoading: false,
  isError: false,
  hasNextPage: true,
  isFetchingNextPage: false,
  fetchNextPage: fetchNextReceived,
  refetch: refetchReceived,
};

vi.mock("../../hooks/useClientReceivedBudgets", () => ({
  useClientReceivedBudgets: () => receivedState,
}));

const pendingState: { count: number; isLoading: boolean; isError?: boolean } = {
  count: 0,
  isLoading: false,
};

vi.mock("../../hooks/useClientPendingApprovalServicesCount", () => ({
  useClientPendingApprovalServicesCount: () => pendingState,
}));

vi.mock("../ReceivedBudgetDetailsSheet", () => ({
  ReceivedBudgetDetailsSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) => (
    <div data-testid="received-sheet" data-open={open ? "true" : "false"}>
      <button type="button" onClick={() => onOpenChange(false)}>
        fechar-orçamento
      </button>
      <button type="button" onClick={() => onOpenChange(true)}>
        manter-orçamento
      </button>
    </div>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ClientBudgetsPage />
    </MemoryRouter>,
  );
}

function resetPageMocks() {
  filtersState.hasActiveFilters = false;
  receivedState.items = [receivedItem];
  receivedState.totalCount = 1;
  receivedState.isLoading = false;
  receivedState.isError = false;
  receivedState.hasNextPage = true;
  pendingState.count = 0;
  pendingState.isLoading = false;
  delete pendingState.isError;
}

describe("ClientBudgetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPageMocks();
  });

  it("renders header and received list", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Orçamentos/i })).toBeInTheDocument();
    expect(screen.getByText("Pedido A")).toBeInTheDocument();
  });

  it("loads more when button visible", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(fetchNextReceived).toHaveBeenCalled();
  });

  it("shows skeleton while loading", () => {
    receivedState.isLoading = true;
    renderPage();
    expect(screen.getByRole("list", { busy: true })).toBeInTheDocument();
  });

  it("shows error state and retries received list", () => {
    receivedState.isError = true;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetchReceived).toHaveBeenCalled();
  });

  it("shows empty state", () => {
    receivedState.items = [];
    renderPage();
    expect(screen.getByText(/Nenhum orçamento recebido ainda/i)).toBeInTheDocument();
  });

  it("shows empty state with filters", () => {
    receivedState.items = [];
    filtersState.hasActiveFilters = true;
    renderPage();
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument();
  });

  it("hides header summary while pending approval count loads", () => {
    pendingState.isLoading = true;
    renderPage();
    expect(screen.queryByText(/serviço com orçamento aguardando aprovação/)).not.toBeInTheDocument();
  });

  it("keeps header summary visible while list reloads", () => {
    pendingState.count = 1;
    receivedState.isLoading = true;
    renderPage();
    expect(
      screen.getByText(/1 serviço com orçamento aguardando aprovação/),
    ).toBeInTheDocument();
  });

  it("opens and closes received details sheet from card click", () => {
    renderPage();
    const cards = screen.getAllByRole("button", { name: /Pedido A/i });
    fireEvent.click(cards[0]);
    expect(screen.getByTestId("received-sheet")).toHaveAttribute("data-open", "true");
    fireEvent.click(screen.getByRole("button", { name: /manter-orçamento/i }));
    expect(screen.getByTestId("received-sheet")).toHaveAttribute("data-open", "true");
    fireEvent.click(screen.getByRole("button", { name: /fechar-orçamento/i }));
    expect(screen.getByTestId("received-sheet")).toHaveAttribute("data-open", "false");
  });

  it("shows header error state for pending approval count", () => {
    pendingState.isError = true;
    renderPage();
    expect(screen.getByText(/— serviços \(indisponível\)/)).toBeInTheDocument();
  });
});
