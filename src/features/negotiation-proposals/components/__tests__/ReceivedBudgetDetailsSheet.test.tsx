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

vi.mock("../BudgetCompareProviderCard", () => ({
  BudgetCompareProviderCard: ({
    onProposalAction,
  }: {
    onProposalAction?: (action: string) => void;
  }) => (
    <div data-testid="provider-budget-card">
      {onProposalAction ? (
        <button type="button" onClick={() => onProposalAction("accept")}>
          Ação proposta
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../AcceptProposalDialog", () => ({
  AcceptProposalDialog: ({
    open,
    onRetry,
  }: {
    open: boolean;
    onRetry?: () => void;
  }) =>
    open ? (
      <div data-testid="accept-proposal-dialog">
        Aceitar proposta
        <button type="button" data-testid="accept-retry" onClick={() => onRetry?.()}>
          Retry accept
        </button>
      </div>
    ) : null,
}));

vi.mock("../RejectProposalDialog", () => ({
  RejectProposalDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reject-proposal-dialog">Recusar proposta</div> : null,
}));

vi.mock("../RevisionRequestDialog", () => ({
  RevisionRequestDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="revision-proposal-dialog">Solicitar revisão</div> : null,
}));

const acceptRefetch = vi.fn();

const dialogsState = {
  acceptOpen: false,
  rejectOpen: false,
  revisionOpen: false,
  acceptDetailData: { proposal_suggested_slots: [] as unknown[], revision_count: 1 } as {
    proposal_suggested_slots: unknown[];
    revision_count: number;
  } | null,
  revisionDetailData: { revision_count: 0 } as { revision_count: number } | null,
  handleProposalAction: vi.fn(),
};

vi.mock("../../hooks/useServiceRequestBudgetProposalDialogs", () => ({
  useServiceRequestBudgetProposalDialogs: () => ({
    acceptOpen: dialogsState.acceptOpen,
    acceptProposalId: dialogsState.acceptOpen ? "bp1" : null,
    acceptProposalDetailQuery: {
      data: dialogsState.acceptOpen ? dialogsState.acceptDetailData : null,
      isLoading: false,
      isError: false,
      refetch: acceptRefetch,
    },
    handleAcceptDialogOpenChange: vi.fn(),
    handleAcceptRequestRevision: vi.fn(),
    rejectOpen: dialogsState.rejectOpen,
    rejectProposalId: dialogsState.rejectOpen ? "bp1" : null,
    handleRejectDialogOpenChange: vi.fn(),
    revisionOpen: dialogsState.revisionOpen,
    revisionProposalId: dialogsState.revisionOpen ? "bp1" : null,
    revisionInitialValues: null,
    revisionProposalDetailQuery: {
      data: dialogsState.revisionOpen ? dialogsState.revisionDetailData : null,
      isLoading: false,
    },
    handleRevisionDialogOpenChange: vi.fn(),
    handleProposalAction: dialogsState.handleProposalAction,
  }),
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
  rating_avg: null,
  rating_count: 0,
  completed_services_count: 0,
  proposed_amount: 500,
  revision_count: 0,
  status: "PENDING",
  submitted_at: null,
  created_at: "2024-01-01T00:00:00Z",
  proposal_description: "Desc",
  proposal_suggested_slots: [
    { start_date: "2026-06-10", shift: "morning" },
  ],
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
    dialogsState.acceptOpen = false;
    dialogsState.rejectOpen = false;
    dialogsState.revisionOpen = false;
    dialogsState.acceptDetailData = { proposal_suggested_slots: [], revision_count: 1 };
    dialogsState.revisionDetailData = { revision_count: 0 };
    dialogsState.handleProposalAction.mockReset();
    acceptRefetch.mockReset();
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
    expect(screen.getByTestId("provider-budget-card")).toBeInTheDocument();
    expect(screen.getByText(/Como escolher o melhor orçamento/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1 profissional com proposta para este pedido/i),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(/1 profissional enviou proposta para este pedido/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Como escolher o melhor orçamento/i)).not.toBeInTheDocument();
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
    expect(
      screen.getByText(/Este pedido ainda não possui orçamentos ativos para comparação/i),
    ).toBeInTheDocument();
  });

  it("shows history empty copy in history mode", () => {
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
        sheetMode="history"
        onOpenChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Este pedido ainda não possui orçamentos registrados/i),
    ).toBeInTheDocument();
  });

  it("shows guidance and trust panels in compare mode", () => {
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
    expect(screen.getByText(/Sua segurança na Prestway/i)).toBeInTheDocument();
  });

  it("shows error alert and refetches on retry", () => {
    const refetch = vi.fn();
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
      detail: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Não foi possível carregar os detalhes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("keeps only the latest budget per provider", () => {
    const older: ServiceRequestBudgetCompareProposal = {
      ...proposal,
      id: "bp0",
      created_at: "2023-01-01T00:00:00Z",
    };
    const otherProvider: ServiceRequestBudgetCompareProposal = {
      ...proposal,
      id: "bp2",
      provider_id: "pr2",
      provider_name: "Outro",
    };
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
      detail: { ...detailBase, budgets: [proposal, older, otherProvider] },
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
    expect(screen.getAllByTestId("provider-budget-card")).toHaveLength(2);
    expect(document.body.textContent).toMatch(/2 profissionais com proposta para este pedido/);
  });

  it("renders accept reject and revision dialogs when open", () => {
    dialogsState.acceptOpen = true;
    dialogsState.rejectOpen = true;
    dialogsState.revisionOpen = true;
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
    expect(screen.getByTestId("accept-proposal-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("reject-proposal-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("revision-proposal-dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("accept-retry"));
    expect(acceptRefetch).toHaveBeenCalled();
  });

  it("wires proposal actions only in compare mode", () => {
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { rerender } = renderReceivedSheet(
      <ReceivedBudgetDetailsSheet
        open
        serviceRequestId="sr1"
        sheetMode="compare"
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ação proposta/i }));
    expect(dialogsState.handleProposalAction).toHaveBeenCalledWith("accept");

    dialogsState.handleProposalAction.mockClear();
    rerender(
      createElement(
        QueryClientProvider,
        {
          client: new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          }),
        },
        <ReceivedBudgetDetailsSheet
          open
          serviceRequestId="sr1"
          sheetMode="history"
          onOpenChange={vi.fn()}
        />,
      ) as ReactElement,
    );
    expect(screen.queryByRole("button", { name: /Ação proposta/i })).not.toBeInTheDocument();
  });

  it("uses plural history copy when multiple providers sent proposals", () => {
    const other: ServiceRequestBudgetCompareProposal = {
      ...proposal,
      id: "bp2",
      provider_id: "pr2",
    };
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
      detail: { ...detailBase, budgets: [proposal, other] },
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
    expect(
      screen.getByText(/2 profissionais enviou proposta para este pedido/i),
    ).toBeInTheDocument();
  });

  it("falls back when accept and revision detail queries have no data", () => {
    dialogsState.acceptOpen = true;
    dialogsState.revisionOpen = true;
    dialogsState.acceptDetailData = null;
    dialogsState.revisionDetailData = null;
    vi.mocked(detailHook.useServiceRequestBudgetCompareDetail).mockReturnValue({
      detail: {
        ...detailBase,
        service_request: { ...detailBase.service_request, title: "" },
      },
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
    expect(screen.getByTestId("accept-proposal-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("revision-proposal-dialog")).toBeInTheDocument();
    expect(screen.queryByText("Meu pedido")).not.toBeInTheDocument();
  });
});
