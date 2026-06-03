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

vi.mock("../BudgetRejectReasonDialog", () => ({
  BudgetRejectReasonDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="stub-reject">
        <button type="button" onClick={() => onOpenChange(true)}>
          reject-open-true
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          reject-open-false
        </button>
      </div>
    ) : null,
}));

function renderWithClient(ui: ReactElement) {
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

describe("ReceivedBudgetDetailsSheet (reject dialog wiring)", () => {
  beforeEach(() => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReset();
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("keeps reject dialog open when child emits onOpenChange(true)", () => {
    renderWithClient(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Recusar orçamento/i }));
    expect(screen.getByTestId("stub-reject")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /reject-open-true/i, hidden: true }),
    );
    expect(screen.getByTestId("stub-reject")).toBeInTheDocument();
  });

  it("closes reject dialog when child emits onOpenChange(false)", () => {
    renderWithClient(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Recusar orçamento/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /reject-open-false/i, hidden: true }),
    );
    expect(screen.queryByTestId("stub-reject")).not.toBeInTheDocument();
  });
});
