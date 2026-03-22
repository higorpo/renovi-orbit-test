import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderBudgetsPage } from "../ProviderBudgetsPage";
import {
  createProviderOwnQuestion,
  createProviderSentBudget,
} from "../../__tests__/fixtures/providerBudgetsFixtures";

vi.mock("@/components/ui/tabs", async () => {
  const React = await import("react");

  const TabsCtx = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
  } | null>(null);

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
    }: {
      children: React.ReactNode;
      value: string;
      onValueChange: (v: string) => void;
    }) => (
      <TabsCtx.Provider value={{ value, onValueChange }}>{children}</TabsCtx.Provider>
    ),
    TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div role="tablist" className={className}>
        {children}
      </div>
    ),
    TabsTrigger: ({
      value: triggerValue,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsCtx);
      return (
        <button
          type="button"
          role="tab"
          className={className}
          onClick={() => ctx?.onValueChange(triggerValue)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      value: contentValue,
      children,
      className,
    }: {
      value: string;
      children: React.ReactNode;
      className?: string;
    }) => {
      const ctx = React.useContext(TabsCtx);
      if (!ctx || ctx.value !== contentValue) return null;
      return <div className={className}>{children}</div>;
    },
  };
});

const mocks = vi.hoisted(() => ({
  budgets: {
    items: [] as ReturnType<typeof createProviderSentBudget>[],
    totalCount: 0,
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  questions: {
    items: [] as ReturnType<typeof createProviderOwnQuestion>[],
    totalCount: 0,
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  pending: {
    count: 0,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("../../hooks/useProviderSentBudgets", () => ({
  useProviderSentBudgets: () => mocks.budgets,
}));

vi.mock("../../hooks/useProviderOwnQuestions", () => ({
  useProviderOwnQuestions: () => mocks.questions,
}));

vi.mock("../../hooks/useProviderPendingQuestionsCount", () => ({
  useProviderPendingQuestionsCount: () => mocks.pending,
}));

vi.mock("../BudgetCard", () => ({
  BudgetCard: ({ budget }: { budget: { id: string; service_request_title: string } }) => (
    <div data-testid={`budget-${budget.id}`}>{budget.service_request_title}</div>
  ),
}));

vi.mock("../QuestionCard", () => ({
  QuestionCard: ({ question }: { question: { id: string; service_request_title: string } }) => (
    <div data-testid={`question-${question.id}`}>{question.service_request_title}</div>
  ),
}));

describe("ProviderBudgetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.budgets.isLoading = false;
    mocks.budgets.isError = false;
    mocks.budgets.items = [];
    mocks.budgets.hasNextPage = false;
    mocks.budgets.isFetchingNextPage = false;
    mocks.questions.isLoading = false;
    mocks.questions.isError = false;
    mocks.questions.items = [];
    mocks.questions.totalCount = 0;
    mocks.questions.hasNextPage = false;
    mocks.pending.isLoading = false;
  });

  it("shows skeleton list while budgets load", () => {
    mocks.budgets.isLoading = true;
    const { container } = render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows questions skeleton when perguntas tab is active", async () => {
    mocks.questions.isLoading = true;
    const { container } = render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    const perguntasTab = screen.getByRole("tab", { name: /perguntas/i });
    fireEvent.click(perguntasTab);
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    });
  });

  it("shows error and retries budgets refetch", () => {
    mocks.budgets.isError = true;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(mocks.budgets.refetch).toHaveBeenCalled();
  });

  it("shows questions error and retries questions refetch", async () => {
    mocks.questions.isError = true;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /perguntas/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(mocks.questions.refetch).toHaveBeenCalled();
  });

  it("renders budget cards and load more", () => {
    mocks.budgets.items = [
      createProviderSentBudget({ id: "b1", service_request_title: "Job A" }),
    ];
    mocks.budgets.totalCount = 1;
    mocks.budgets.hasNextPage = true;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("budget-b1")).toHaveTextContent("Job A");
    fireEvent.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(mocks.budgets.fetchNextPage).toHaveBeenCalled();
  });

  it("loads more items on perguntas tab", async () => {
    mocks.questions.items = [createProviderOwnQuestion({ id: "q1" })];
    mocks.questions.hasNextPage = true;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: /perguntas/i }));
    await waitFor(() => {
      expect(screen.getByTestId("question-q1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(mocks.questions.fetchNextPage).toHaveBeenCalled();
  });

  it("switches to perguntas tab and shows question cards", async () => {
    mocks.budgets.items = [createProviderSentBudget({ id: "b1" })];
    mocks.questions.items = [createProviderOwnQuestion({ id: "q1" })];
    mocks.questions.totalCount = 1;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("budget-b1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /perguntas/i }));
    await waitFor(() => {
      expect(screen.getByTestId("question-q1")).toBeInTheDocument();
    });
  });

  it("shows default empty state when there are no budgets and no filters", () => {
    mocks.budgets.items = [];
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/você ainda não enviou nenhum orçamento/i),
    ).toBeInTheDocument();
  });

  it("shows empty state with clear filters when search has no matches", async () => {
    mocks.budgets.items = [];
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "zzznomatch" },
    });
    await waitFor(
      () => {
        expect(screen.getByText(/nenhum resultado encontrado/i)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toHaveValue("");
    });
  });

  it("shows load more fetching state on button", () => {
    mocks.budgets.items = [createProviderSentBudget({ id: "b1" })];
    mocks.budgets.hasNextPage = true;
    mocks.budgets.isFetchingNextPage = true;
    render(
      <MemoryRouter>
        <ProviderBudgetsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /carregando/i })).toBeDisabled();
  });
});
