import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderBudgetsPage } from "../ProviderBudgetsPage";
import { createProviderSentBudget } from "../../__tests__/fixtures/providerBudgetsFixtures";

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
}));

vi.mock("../../hooks/useProviderSentBudgets", () => ({
  useProviderSentBudgets: () => mocks.budgets,
}));

vi.mock("../../hooks/useProviderPendingApprovalBudgetsCount", () => ({
  useProviderPendingApprovalBudgetsCount: () => ({
    count: 0,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../BudgetCard", () => ({
  BudgetCard: ({ budget }: { budget: { id: string; service_request_title: string } }) => (
    <div data-testid={`budget-${budget.id}`}>{budget.service_request_title}</div>
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
