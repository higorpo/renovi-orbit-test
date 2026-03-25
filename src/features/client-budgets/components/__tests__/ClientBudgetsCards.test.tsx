import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ReceivedBudgetServiceCard } from "../ReceivedBudgetServiceCard";
import { QuestionServiceCard } from "../QuestionServiceCard";
import { ReceivedBudgetCardSkeleton } from "../ReceivedBudgetCardSkeleton";
import { QuestionServiceCardSkeleton } from "../QuestionServiceCardSkeleton";
import type { BudgetPreviewItem, ClientQuestionServiceGroup, ClientReceivedServiceGroup } from "../../types/client-budgets.types";

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: "https://img.example/a.png" }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "há 1 dia",
}));

vi.mock("@/features/client-my-services", () => ({
  getServiceRequestsPageUrlWithFocus: (id: string) => `/dashboard/client/meus-servicos?serviceRequestId=${id}`,
}));

const budgetPreview: BudgetPreviewItem = {
  id: "b1",
  provider_id: "p1",
  provider_name: "Ana",
  provider_slug: "ana",
  provider_profile_image_path: null,
  proposed_amount: 800,
  status: "submitted",
  created_at: "2024-01-01T00:00:00Z",
};

const receivedItem: ClientReceivedServiceGroup = {
  service_request_id: "sr-recv",
  service_request_title: "Reforma",
  service_request_description: "Cozinha",
  service_request_status: "open",
  service_request_created_at: "2024-01-01T00:00:00Z",
  service_title: "Pedreiro",
  service_slug: "pedreiro",
  service_icon_key: null,
  service_color_key: null,
  neighborhood: "Vila",
  city: "Campinas",
  state_abbr: "SP",
  latest_budget_at: null,
  total_budgets: 3,
  submitted_count: 3,
  accepted_count: 0,
  rejected_count: 0,
  withdrawn_count: 0,
  budgets_preview: [
    budgetPreview,
    { ...budgetPreview, id: "b2", proposed_amount: 900 },
    { ...budgetPreview, id: "b3", proposed_amount: 1000 },
  ],
};

const questionItem: ClientQuestionServiceGroup = {
  service_request_id: "sr-q",
  service_request_title: "Elétrica",
  service_request_description: null,
  service_request_status: "open",
  service_request_created_at: "2024-01-02T00:00:00Z",
  service_title: "Eletricista",
  service_slug: "eletricista",
  service_icon_key: null,
  service_color_key: null,
  neighborhood: null,
  city: null,
  state_abbr: null,
  total_questions: 4,
  pending_questions_count: 4,
  answered_questions_count: 0,
  latest_question_at: null,
  questions_preview: [
    {
      id: "q1",
      provider_id: "p1",
      provider_name: "Bob",
      provider_slug: "bob",
      provider_profile_image_path: null,
      question: "Tem disjuntor?",
      client_response: null,
      client_response_images: [],
      created_at: "2024-01-03T00:00:00Z",
      client_responded_at: null,
    },
    {
      id: "q2",
      provider_id: "p2",
      provider_name: "Cid",
      provider_slug: "cid",
      provider_profile_image_path: null,
      question: "Horário?",
      client_response: null,
      client_response_images: [],
      created_at: "2024-01-04T00:00:00Z",
      client_responded_at: null,
    },
  ],
};

describe("ReceivedBudgetServiceCard", () => {
  it("opens details on card click and Enter key", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <ReceivedBudgetServiceCard
          item={receivedItem}
          statusFilter="awaiting_decision"
          onOpenDetails={onOpen}
        />
      </MemoryRouter>,
    );
    const card = container.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    expect(card).toBeTruthy();
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledWith("sr-recv");
    onOpen.mockClear();
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith("sr-recv");
  });

  it("shows extra budgets label when more than two submitted", () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <ReceivedBudgetServiceCard
          item={receivedItem}
          statusFilter="awaiting_decision"
          onOpenDetails={onOpen}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/\.\.\. e outros orçamentos/i)).toBeInTheDocument();
  });

  it("CTA button stops propagation and opens details", () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <ReceivedBudgetServiceCard
          item={{ ...receivedItem, submitted_count: 1, budgets_preview: [budgetPreview] }}
          statusFilter="awaiting_decision"
          onOpenDetails={onOpen}
        />
      </MemoryRouter>,
    );
    const ctaButtons = screen.getAllByRole("button", { name: /Ver detalhes do orçamento/i });
    fireEvent.click(ctaButtons[ctaButtons.length - 1]);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("QuestionServiceCard", () => {
  it("renders summary and opens details", () => {
    const onOpen = vi.fn();
    render(
      <MemoryRouter>
        <QuestionServiceCard
          item={questionItem}
          statusFilter="pending"
          onOpenDetails={onOpen}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Tem disjuntor?")).toBeInTheDocument();
    const ctas = screen.getAllByRole("button", { name: /Ver perguntas/i });
    fireEvent.click(ctas[ctas.length - 1]);
    expect(onOpen).toHaveBeenCalledWith("sr-q");
  });

  it("opens details on Space key on card", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <QuestionServiceCard
          item={questionItem}
          statusFilter="pending"
          onOpenDetails={onOpen}
        />
      </MemoryRouter>,
    );
    const card = container.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    fireEvent.keyDown(card, { key: " " });
    expect(onOpen).toHaveBeenCalledWith("sr-q");
  });

  it("shows extra questions label when more than two previews", () => {
    const onOpen = vi.fn();
    const item: ClientQuestionServiceGroup = {
      ...questionItem,
      total_questions: 5,
      pending_questions_count: 5,
      questions_preview: questionItem.questions_preview,
    };
    render(
      <MemoryRouter>
        <QuestionServiceCard item={item} statusFilter="pending" onOpenDetails={onOpen} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/\.\.\. e outras perguntas/i)).toBeInTheDocument();
  });
});

describe("skeleton cards", () => {
  it("renders ReceivedBudgetCardSkeleton", () => {
    const { container } = render(<ReceivedBudgetCardSkeleton />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders QuestionServiceCardSkeleton", () => {
    const { container } = render(<QuestionServiceCardSkeleton />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });
});
