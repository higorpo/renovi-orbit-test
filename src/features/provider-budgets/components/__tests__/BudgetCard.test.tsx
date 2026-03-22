import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Wrench } from "lucide-react";
import { createProviderSentBudget } from "../../__tests__/fixtures/providerBudgetsFixtures";
import { BudgetCard } from "../BudgetCard";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({ color: "bg-blue-500", Icon: Wrench }),
  useServiceRequestPhotoUrls: () => ({ urls: ["https://x.test/a.jpg"], isLoading: false }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "Há 1 dia",
}));

vi.mock("@/features/provider-jobs/constants/jobDetailReturnNavigation", () => ({
  jobDetailPathFromBudgets: (id: string) => `/dashboard/budgets/pedido/${id}`,
}));

describe("BudgetCard", () => {
  it("renders title, amount, status and detail links", () => {
    const budget = createProviderSentBudget({
      service_request_title: "Troca de disjuntor",
      proposed_amount: 320.5,
      status: "accepted",
    });

    render(
      <MemoryRouter>
        <BudgetCard budget={budget} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Troca de disjuntor")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*320,50/)).toBeInTheDocument();
    expect(screen.getByText("Aceito")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /ver detalhes/i })).toHaveLength(2);
  });

  it("omits description block when description is null", () => {
    const budget = createProviderSentBudget({
      service_request_description: null,
    });
    render(
      <MemoryRouter>
        <BudgetCard budget={budget} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Na cozinha")).not.toBeInTheDocument();
  });

  it("renders location line when neighborhood and city are set", () => {
    const budget = createProviderSentBudget({
      neighborhood: "Trindade",
      city: "Florianópolis",
    });
    render(
      <MemoryRouter>
        <BudgetCard budget={budget} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Trindade, Florianópolis/)).toBeInTheDocument();
  });

  it("renders main link when request has photos", () => {
    const budget = createProviderSentBudget({
      service_request_photos: ["p1.jpg"],
    });
    render(
      <MemoryRouter>
        <BudgetCard budget={budget} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /ver detalhes: instalar tomada/i }),
    ).toBeInTheDocument();
  });
});
