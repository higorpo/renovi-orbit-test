import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ReceivedBudgetServiceCard } from "../ReceivedBudgetServiceCard";
import { ReceivedBudgetCardSkeleton } from "../ReceivedBudgetCardSkeleton";
import type { BudgetPreviewItem, ClientReceivedServiceGroup } from "../../types/client-budgets.types";

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
  budgets_preview: [
    budgetPreview,
    { ...budgetPreview, id: "b2", proposed_amount: 900 },
    { ...budgetPreview, id: "b3", proposed_amount: 1000 },
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
    onOpen.mockClear();
    fireEvent.keyDown(card, { key: " " });
    expect(onOpen).toHaveBeenCalledWith("sr-recv");
    onOpen.mockClear();
    fireEvent.keyDown(card, { key: "Escape" });
    expect(onOpen).not.toHaveBeenCalled();
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

  it("Gerenciar serviço link navigates without double-opening details", () => {
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
    const link = screen.getByRole("link", { name: /Gerenciar serviço/i });
    expect(link).toHaveAttribute("href", "/dashboard/client/meus-servicos?serviceRequestId=sr-recv");
    fireEvent.click(link);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("skeleton cards", () => {
  it("renders ReceivedBudgetCardSkeleton", () => {
    const { container } = render(<ReceivedBudgetCardSkeleton />);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });
});
