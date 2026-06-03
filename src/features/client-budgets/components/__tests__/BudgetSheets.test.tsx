import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReceivedBudgetDetailsSheet } from "../ReceivedBudgetDetailsSheet";
import { QuestionThreadSheet } from "../QuestionThreadSheet";
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

const mockQuestionResponseImageUrls = vi.fn(() => ({
  urls: ["https://img"],
  isLoading: false,
}));

vi.mock("../../hooks/useQuestionResponseImageUrls", () => ({
  useQuestionResponseImageUrls: () => mockQuestionResponseImageUrls(),
}));

vi.mock("../QuestionResponseComposer", () => ({
  QuestionResponseComposer: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }) =>
    open ? (
      <div data-testid="question-composer">
        <button type="button" onClick={() => onOpenChange(false)}>
          fechar-composer
        </button>
        <button type="button" onClick={() => onOpenChange(true)}>
          noop-composer
        </button>
      </div>
    ) : null,
}));


function renderReceivedSheet(ui: ReactElement) {
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
  questions: [],
};

describe("ReceivedBudgetDetailsSheet", () => {
  beforeEach(() => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReset();
  });

  it("shows loading skeleton", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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

  it("shows empty alert in compare mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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
  });

  it("renders provider block when budgets exist", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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
    expect(screen.getByTestId("profile-preview")).toBeInTheDocument();
    expect(screen.getByTestId("current-proposal")).toBeInTheDocument();
  });

  it("renders history subsection when provider has multiple versions", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        budgets: [
          proposal,
          { ...proposal, id: "bp2", proposed_amount: 300, status: "REVISED" as const },
        ],
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
    expect(screen.getByText(/Histórico/i)).toBeInTheDocument();
  });

  it("shows history copy when sheet mode is history and empty", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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
    expect(screen.getByText(/registrados/i)).toBeInTheDocument();
  });

  it("opens reject reason dialog from compare mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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
    fireEvent.click(screen.getByRole("button", { name: /Recusar orçamento/i }));
    expect(screen.getByRole("dialog", { name: /Recusar orçamento/i })).toBeInTheDocument();
  });

  it("disables reject in history mode", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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
    expect(screen.getByRole("button", { name: /Recusar orçamento/i })).toBeDisabled();
  });

  it("shows load error and calls refetch on retry", () => {
    const refetch = vi.fn();
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
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

  it("disables reject in compare mode when latest proposal is not submitted", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        budgets: [{ ...proposal, status: "accepted" as const }],
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
    expect(screen.getByRole("button", { name: /Recusar orçamento/i })).toBeDisabled();
  });
});

describe("QuestionThreadSheet", () => {
  beforeEach(() => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReset();
    mockQuestionResponseImageUrls.mockReturnValue({
      urls: ["https://img"],
      isLoading: false,
    });
  });

  it("shows loading state", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Carregando perguntas/i)).toBeInTheDocument();
  });

  it("shows empty state when no questions", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: detailBase,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText(/Nenhuma pergunta para este pedido/i)).toBeInTheDocument();
  });

  it("shows respond button and opens composer", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q1",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "Dúvida?",
            client_response: null,
            client_response_images: [],
            created_at: "2024-01-02T00:00:00Z",
            client_responded_at: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Responder/i }));
    expect(screen.getByTestId("question-composer")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /noop-composer/i, hidden: true }),
    );
    expect(screen.getByTestId("question-composer")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /fechar-composer/i, hidden: true }),
    );
    expect(screen.queryByTestId("question-composer")).not.toBeInTheDocument();
  });

  it("shows image placeholders while response images load", () => {
    mockQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: true });
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q2",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "Ok?",
            client_response: "Sim",
            client_response_images: ["a", "b"],
            created_at: "2024-01-02T00:00:00Z",
            client_responded_at: "2024-01-03T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    const busyRegions = document.querySelectorAll(".animate-pulse");
    expect(busyRegions.length).toBeGreaterThan(0);
  });

  it("sorts pending questions before answered", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q-answered",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "OLD_ANSWERED_MARKER",
            client_response: "yes",
            client_response_images: [],
            created_at: "2020-01-01T00:00:00Z",
            client_responded_at: "2020-01-02T00:00:00Z",
          },
          {
            id: "q-pending",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "NEW_PENDING_MARKER",
            client_response: null,
            client_response_images: [],
            created_at: "2024-06-01T00:00:00Z",
            client_responded_at: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    const pendingEl = screen.getByText("NEW_PENDING_MARKER");
    const answeredEl = screen.getByText("OLD_ANSWERED_MARKER");
    expect(
      pendingEl.compareDocumentPosition(answeredEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("shows load error and refetches from retry", () => {
    const refetch = vi.fn();
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />);
    expect(screen.getByText(/Não foi possível carregar as perguntas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("sorts two pending questions by created_at descending", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q-old",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "OLDER",
            client_response: null,
            client_response_images: [],
            created_at: "2020-01-01T00:00:00Z",
            client_responded_at: null,
          },
          {
            id: "q-new",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "NEWER",
            client_response: null,
            client_response_images: [],
            created_at: "2024-06-01T00:00:00Z",
            client_responded_at: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />);
    const newer = screen.getByText("NEWER");
    const older = screen.getByText("OLDER");
    expect(
      newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("hides image grid when signed URLs resolve empty", () => {
    mockQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: false });
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q2",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "Ok?",
            client_response: "Sim",
            client_response_images: ["path/1"],
            created_at: "2024-01-02T00:00:00Z",
            client_responded_at: "2024-01-03T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(container.querySelectorAll("img").length).toBe(0);
  });

  it("renders client response with images when answered", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q2",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "Ok?",
            client_response: "Sim",
            client_response_images: ["path/1"],
            created_at: "2024-01-02T00:00:00Z",
            client_responded_at: "2024-01-03T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(
      <QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Sim")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /Imagem da resposta 1/i });
    expect(img).toHaveAttribute("src", "https://img");
    fireEvent.error(img);
    expect(img).toHaveStyle({ display: "none" });
  });

  it("uses em dash when service request title is null after load", () => {
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        service_request: { ...detailBase.service_request, title: null as unknown as string },
        questions: [],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("passes empty paths to ResponseImages when response images are undefined", () => {
    mockQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: false });
    vi.mocked(detailHook.useClientBudgetDetail).mockReturnValue({
      detail: {
        ...detailBase,
        questions: [
          {
            id: "q-undef-img",
            provider_id: "p1",
            provider_name: "P",
            provider_slug: "p",
            provider_profile_image_path: null,
            question: "Fotos?",
            client_response: "Segue",
            client_response_images: undefined as unknown as string[],
            created_at: "2024-01-02T00:00:00Z",
            client_responded_at: "2024-01-03T00:00:00Z",
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<QuestionThreadSheet open serviceRequestId="sr1" onOpenChange={vi.fn()} />);
    expect(screen.getByText("Segue")).toBeInTheDocument();
  });
});
