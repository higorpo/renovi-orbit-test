import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Paintbrush } from "lucide-react";
import { createProviderOwnQuestion } from "../../__tests__/fixtures/providerBudgetsFixtures";
import { QuestionCard } from "../QuestionCard";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({ color: "bg-rose-500", Icon: Paintbrush }),
  useServiceRequestPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "Há 2 h",
}));

vi.mock("@/features/provider-jobs/constants/jobDetailReturnNavigation", () => ({
  jobDetailPathFromBudgets: (id: string) => `/dashboard/budgets/pedido/${id}`,
}));

describe("QuestionCard", () => {
  it("renders question and pending status", () => {
    const question = createProviderOwnQuestion({
      service_request_title: "Pintar sala",
      question: "Inclui massa corrida?",
    });

    render(
      <MemoryRouter>
        <QuestionCard question={question} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Pintar sala")).toBeInTheDocument();
    expect(screen.getByText("Inclui massa corrida?")).toBeInTheDocument();
    expect(screen.getByText("Aguardando resposta")).toBeInTheDocument();
  });

  it("shows client response block when present", () => {
    const question = createProviderOwnQuestion({
      client_response: "Sim, inclui",
    });

    render(
      <MemoryRouter>
        <QuestionCard question={question} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sim, inclui")).toBeInTheDocument();
    expect(screen.getByText(/resposta do cliente/i)).toBeInTheDocument();
  });

  it("renders location when neighborhood and city exist", () => {
    const question = createProviderOwnQuestion({
      neighborhood: "Centro",
      city: "São Paulo",
    });
    render(
      <MemoryRouter>
        <QuestionCard question={question} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Centro, São Paulo/)).toBeInTheDocument();
  });

  it("shows proposal hint when has_proposal", () => {
    const question = createProviderOwnQuestion({ has_proposal: true });
    render(
      <MemoryRouter>
        <QuestionCard question={question} />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/você também enviou um orçamento/i),
    ).toBeInTheDocument();
  });
});
