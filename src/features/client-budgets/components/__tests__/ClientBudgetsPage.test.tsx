import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { ClientBudgetsPage } from "../ClientBudgetsPage";
import type {
  ClientBudgetsTab,
  ClientReceivedServiceGroup,
  ClientQuestionServiceGroup,
} from "../../types/client-budgets.types";

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
const setActiveTab = vi.fn();
const setReceivedStatusFilter = vi.fn();
const setQuestionStatusFilter = vi.fn();
const setSearchQuery = vi.fn();
const fetchNextReceived = vi.fn();
const fetchNextQuestions = vi.fn();
const refetchReceived = vi.fn();
const refetchQuestions = vi.fn();

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
  withdrawn_count: 0,
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

const questionGroup: ClientQuestionServiceGroup = {
  service_request_id: "sr-q",
  service_request_title: "Pedido Q",
  service_request_description: null,
  service_request_status: "open",
  service_request_created_at: "2024-01-02T00:00:00Z",
  service_title: "Serviço",
  service_slug: "svc",
  service_icon_key: null,
  service_color_key: null,
  neighborhood: null,
  city: null,
  state_abbr: null,
  total_questions: 1,
  pending_questions_count: 1,
  answered_questions_count: 0,
  latest_question_at: null,
  questions_preview: [
    {
      id: "q1",
      provider_id: "p1",
      provider_name: "Bob",
      provider_slug: "bob",
      provider_profile_image_path: null,
      question: "Pergunta?",
      client_response: null,
      client_response_images: [],
      created_at: "2024-01-03T00:00:00Z",
      client_responded_at: null,
    },
  ],
};

const filtersState: {
  activeTab: ClientBudgetsTab;
  hasActiveFilters: boolean;
} = {
  activeTab: "recebidos",
  hasActiveFilters: false,
};

vi.mock("../../hooks/useClientBudgetsFilters", () => ({
  useClientBudgetsFilters: () => ({
    activeTab: filtersState.activeTab,
    setActiveTab,
    receivedStatusFilter: "awaiting_decision" as const,
    questionStatusFilter: "pending" as const,
    searchQuery: "",
    setSearchQuery,
    setReceivedStatusFilter,
    setQuestionStatusFilter,
    receivedStatusParam: "awaiting_decision",
    questionStatusParam: "pending",
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

const questionsState = {
  items: [questionGroup] as ClientQuestionServiceGroup[],
  totalCount: 1,
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: fetchNextQuestions,
  refetch: refetchQuestions,
};

vi.mock("../../hooks/useClientBudgetQuestions", () => ({
  useClientBudgetQuestions: () => questionsState,
}));

const pendingState = { count: 0, isLoading: false };

vi.mock("../../hooks/useClientPendingApprovalServicesCount", () => ({
  useClientPendingApprovalServicesCount: () => pendingState,
}));

const pendingQuestionsTotalState = { count: 0, isLoading: false, isError: false };

vi.mock("../../hooks/useClientPendingQuestionsCount", () => ({
  useClientPendingQuestionsCount: () => pendingQuestionsTotalState,
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
    </div>
  ),
}));

vi.mock("../QuestionThreadSheet", () => ({
  QuestionThreadSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) => (
    <div data-testid="question-sheet" data-open={open ? "true" : "false"}>
      <button type="button" onClick={() => onOpenChange(false)}>
        fechar-perguntas
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
  filtersState.activeTab = "recebidos";
  filtersState.hasActiveFilters = false;
  receivedState.items = [receivedItem];
  receivedState.isLoading = false;
  receivedState.isError = false;
  receivedState.hasNextPage = true;
  questionsState.items = [questionGroup];
  questionsState.isLoading = false;
  questionsState.isError = false;
  questionsState.hasNextPage = false;
  pendingState.count = 0;
  pendingState.isLoading = false;
  pendingQuestionsTotalState.count = 0;
  pendingQuestionsTotalState.isLoading = false;
  pendingQuestionsTotalState.isError = false;
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

  it("shows received tab skeleton while loading", () => {
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

  it("shows empty state for received tab", () => {
    receivedState.items = [];
    renderPage();
    expect(screen.getByText(/Nenhum orçamento recebido ainda/i)).toBeInTheDocument();
  });

  it("shows empty state with filters for received tab", () => {
    receivedState.items = [];
    filtersState.hasActiveFilters = true;
    renderPage();
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument();
  });

  it("renders perguntas tab content when activeTab is perguntas", () => {
    filtersState.activeTab = "perguntas";
    renderPage();
    expect(screen.getByText("Pedido Q")).toBeInTheDocument();
  });

  it("shows questions tab skeleton while loading", () => {
    filtersState.activeTab = "perguntas";
    questionsState.isLoading = true;
    renderPage();
    expect(screen.getByRole("list", { busy: true })).toBeInTheDocument();
  });

  it("hides header summary while pending approval count loads", () => {
    pendingState.isLoading = true;
    renderPage();
    expect(screen.queryByText(/serviço com orçamento aguardando aprovação/)).not.toBeInTheDocument();
  });

  it("opens and closes received details sheet from card click", () => {
    renderPage();
    const cards = screen.getAllByRole("button", { name: /Pedido A/i });
    fireEvent.click(cards[0]);
    expect(screen.getByTestId("received-sheet")).toHaveAttribute("data-open", "true");
    fireEvent.click(screen.getByRole("button", { name: /fechar-orçamento/i }));
    expect(screen.getByTestId("received-sheet")).toHaveAttribute("data-open", "false");
  });

  it("loads more on questions tab when hasNextPage", () => {
    filtersState.activeTab = "perguntas";
    questionsState.hasNextPage = true;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(fetchNextQuestions).toHaveBeenCalled();
  });

  it("opens and closes question thread sheet from card click", () => {
    filtersState.activeTab = "perguntas";
    renderPage();
    const cards = screen.getAllByRole("button", { name: /Pedido Q/i });
    fireEvent.click(cards[0]);
    expect(screen.getByTestId("question-sheet")).toHaveAttribute("data-open", "true");
    fireEvent.click(screen.getByRole("button", { name: /fechar-perguntas/i }));
    expect(screen.getByTestId("question-sheet")).toHaveAttribute("data-open", "false");
  });

  it("calls setActiveTab and resetFilters when switching tabs", () => {
    renderPage();
    const perguntasTab = screen.getByRole("tab", { name: "Perguntas" });
    // Radix TabsTrigger commits selection on mouseDown, not click.
    fireEvent.mouseDown(perguntasTab, { button: 0, ctrlKey: false });
    expect(setActiveTab).toHaveBeenCalledWith("perguntas");
    expect(resetFilters).toHaveBeenCalled();
  });

  it("shows questions empty state with filters and clears filters", () => {
    filtersState.activeTab = "perguntas";
    questionsState.items = [];
    filtersState.hasActiveFilters = true;
    renderPage();
    expect(screen.getByText(/Nenhum resultado encontrado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Limpar filtros/i }));
    expect(resetFilters).toHaveBeenCalled();
  });

  it("retries questions list on error", () => {
    filtersState.activeTab = "perguntas";
    questionsState.isError = true;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetchQuestions).toHaveBeenCalled();
  });

  it("shows questions empty state without filters", () => {
    filtersState.activeTab = "perguntas";
    questionsState.items = [];
    renderPage();
    expect(screen.getByText(/Nenhuma pergunta recebida ainda/i)).toBeInTheDocument();
  });
});
