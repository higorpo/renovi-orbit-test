import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import type { ClientServiceCardPresentation } from "../../../utils/clientServiceCardPresentation";
import { ClientServiceListCard } from "../ClientServiceListCard";

const {
  getPresentationMock,
  manualPaymentOpenMock,
  manualPaymentOpenChangeMock,
  manualPaymentCompletedMock,
  profileImageUrlMock,
} = vi.hoisted(() => ({
  getPresentationMock: vi.fn(),
  manualPaymentOpenMock: vi.fn(),
  manualPaymentOpenChangeMock: vi.fn(),
  manualPaymentCompletedMock: vi.fn(),
  profileImageUrlMock: vi.fn(),
}));

vi.mock("../../../utils/clientServiceCardPresentation", () => ({
  getClientServiceCardPresentation: (...args: unknown[]) => getPresentationMock(...args),
}));

vi.mock("../../../hooks/useClientCardManualPayment", () => ({
  useClientCardManualPayment: () => ({
    open: true,
    openModal: manualPaymentOpenMock,
    handleOpenChange: manualPaymentOpenChangeMock,
    handleCompleted: manualPaymentCompletedMock,
    schedule: { id: "schedule-1" },
    context: {
      acceptedProposalId: "proposal-1",
      serviceRequestId: "request-1",
    },
  }),
}));

vi.mock("@/features/provider-profile/hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: () => ({ url: profileImageUrlMock() }),
}));

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    Icon: () => <span data-testid="category-icon" />,
    color: "from-blue-500",
  }),
}));

vi.mock("@/features/view-services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/view-services")>();
  return {
    ...actual,
    getUrgencyConfig: () => ({ label: "Urgente", variant: "destructive" }),
  };
});

vi.mock("@/features/payments", () => ({
  ManualPaymentDialog: ({
    open,
    onOpenChange,
    onCompleted,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCompleted: () => void;
  }) =>
    open ? (
      <div>
        <span>Manual payment</span>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close payment
        </button>
        <button type="button" onClick={onCompleted}>
          Complete payment
        </button>
      </div>
    ) : null,
}));

const model = {
  id: "request-1",
  title: "Instalação elétrica",
  listPhase: "negotiation",
  urgency: "high",
  service: { title: "Eletricista", slug: "eletricista" },
  counterparty: {
    id: "provider-1",
    displayName: "Maria Silva",
    profileImagePath: "avatar.jpg",
  },
  contracted: null,
} as ServiceModel;

function presentation(
  overrides: Partial<ClientServiceCardPresentation> = {},
): ClientServiceCardPresentation {
  return {
    phaseLabel: "Em negociação",
    phaseBadgeVariant: "default",
    highlight: {
      icon: "proposals",
      title: "Novo orçamento para analisar",
      detail: "1 orçamento aguardando sua resposta",
      messagePreview: "Posso realizar amanhã",
      subdetail: "Atualizado agora",
      emphasis: "attention",
    },
    secondaryInfo: [
      { icon: "location", text: "Centro, Florianópolis" },
      { text: "Informação adicional" },
    ],
    showUrgency: true,
    isTodayService: false,
    showProviderHeader: false,
    primaryAction: { label: "Comparar orçamentos", intent: "budgets" },
    secondaryAction: { label: "Ver detalhes", intent: "details" },
    ...overrides,
  };
}

describe("ClientServiceListCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileImageUrlMock.mockReturnValue("https://example.com/avatar.jpg");
    getPresentationMock.mockReturnValue(presentation());
  });

  it("renders category, urgency, highlight and secondary information", () => {
    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Eletricista")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.getByText("Novo orçamento para analisar")).toBeInTheDocument();
    expect(screen.getByText("“Posso realizar amanhã”")).toBeInTheDocument();
    expect(screen.getByText("Centro, Florianópolis")).toBeInTheDocument();
    expect(screen.getByText("Informação adicional")).toBeInTheDocument();
  });

  it("opens details from the card body and details action", () => {
    const onOpenDetails = vi.fn();
    render(<ClientServiceListCard model={model} onOpenDetails={onOpenDetails} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhes de Instalação elétrica" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));

    expect(onOpenDetails).toHaveBeenCalledTimes(2);
    expect(onOpenDetails).toHaveBeenCalledWith(model);
  });

  it.each([
    ["budgets", "Comparar orçamentos", "onOpenBudgets"],
    ["messages", "Ver mensagens", "onOpenMessages"],
    ["chat", "Ver conversa", "onOpenChat"],
  ] as const)("dispatches the %s action", (intent, label, callbackName) => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: { label, intent },
        secondaryAction: null,
      }),
    );
    const callbacks = {
      onOpenBudgets: vi.fn(),
      onOpenMessages: vi.fn(),
      onOpenChat: vi.fn(),
    };

    render(<ClientServiceListCard model={model} {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: label }));

    expect(callbacks[callbackName]).toHaveBeenCalledWith(model);
  });

  it("opens and confirms the cancellation dialog", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: { label: "Cancelar pedido", intent: "cancel" },
        secondaryAction: null,
      }),
    );
    const onCancel = vi.fn();
    render(<ClientServiceListCard model={model} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    expect(screen.getByRole("heading", { name: "Cancelar pedido?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    expect(onCancel).toHaveBeenCalledWith("request-1");
  });

  it("disables an action and exposes its reason", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: {
          label: "Ver conversa",
          intent: "chat",
          disabled: true,
          disabledReason: "Conversa ainda não disponível",
        },
        secondaryAction: null,
      }),
    );
    render(<ClientServiceListCard model={model} />);

    expect(screen.getByRole("button", { name: "Ver conversa" })).toBeDisabled();
  });

  it("opens manual payment and forwards dialog callbacks", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: { label: "Ajustar pagamento", intent: "adjust_payment" },
        secondaryAction: null,
      }),
    );
    const paymentModel = {
      ...model,
      listPhase: "in_progress",
      contracted: { id: "contracted-1" },
    } as ServiceModel;
    render(<ClientServiceListCard model={paymentModel} />);

    fireEvent.click(screen.getByRole("button", { name: "Ajustar pagamento" }));
    expect(manualPaymentOpenMock).toHaveBeenCalledOnce();
    expect(screen.getByText("Manual payment")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close payment" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete payment" }));
    expect(manualPaymentOpenChangeMock).toHaveBeenCalledWith(false);
    expect(manualPaymentCompletedMock).toHaveBeenCalledOnce();
  });

  it("renders the provider header and compact highlight", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        showProviderHeader: true,
        highlight: {
          icon: "completed",
          title: "Avaliação recebida",
          emphasis: "default",
        },
        secondaryInfo: [],
        showUrgency: false,
      }),
    );
    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Avaliação recebida")).toBeInTheDocument();
    expect(screen.queryByText("Urgente")).not.toBeInTheDocument();
  });

  it("omits the highlight block when presentation has none", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        showProviderHeader: true,
        highlight: null,
        secondaryInfo: [{ icon: "date", text: "Concluído em 05/08/2026" }],
        showUrgency: false,
      }),
    );
    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Concluído em 05/08/2026")).toBeInTheDocument();
    expect(screen.queryByText("Serviço concluído")).not.toBeInTheDocument();
  });
});

describe("ClientServiceListCard additional branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileImageUrlMock.mockReturnValue("https://example.com/avatar.jpg");
    getPresentationMock.mockReturnValue(presentation());
  });

  it("renders a title-only highlight", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        highlight: {
          icon: "scheduled",
          title: "Serviço agendado",
          emphasis: "default",
        },
      }),
    );

    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Serviço agendado")).toBeInTheDocument();
  });

  it("renders a non-interactive card body when details callback is omitted", () => {
    render(<ClientServiceListCard model={model} />);

    expect(
      screen.queryByRole("button", { name: "Ver detalhes de Instalação elétrica" }),
    ).not.toBeInTheDocument();
  });

  it("renders a card styled as today's service", () => {
    getPresentationMock.mockReturnValue(presentation({ isTodayService: true }));

    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Instalação elétrica")).toBeInTheDocument();
  });

  it("disables primary and secondary cancellation actions while cancelling", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: { label: "Cancelar agora", intent: "cancel" },
        secondaryAction: { label: "Cancelar pedido", intent: "cancel" },
      }),
    );

    render(<ClientServiceListCard model={model} isCancelling />);

    expect(screen.getByRole("button", { name: "Cancelar agora" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
  });

  it("does not open manual payment without a contracted service", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: { label: "Ajustar pagamento", intent: "adjust_payment" },
        secondaryAction: null,
      }),
    );

    render(<ClientServiceListCard model={{ ...model, contracted: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustar pagamento" }));

    expect(manualPaymentOpenMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Manual payment")).not.toBeInTheDocument();
  });

  it("uses avatar fallback when provider image url is missing", () => {
    profileImageUrlMock.mockReturnValue(null);
    getPresentationMock.mockReturnValue(presentation({ showProviderHeader: true }));

    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("MS")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to the generic service category", () => {
    render(
      <ClientServiceListCard
        model={{ ...model, service: { title: " ", slug: "eletricista" } }}
      />,
    );

    expect(screen.getByText("Serviço")).toBeInTheDocument();
  });

  it("renders provider header when profile url is available", () => {
    profileImageUrlMock.mockReturnValue("https://cdn.example/avatar.jpg");
    getPresentationMock.mockReturnValue(presentation({ showProviderHeader: true }));

    render(<ClientServiceListCard model={model} />);

    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("falls back to Profissional when provider name is missing", () => {
    getPresentationMock.mockReturnValue(presentation({ showProviderHeader: true }));

    render(
      <ClientServiceListCard
        model={{
          ...model,
          counterparty: null,
          counterpartyName: null,
          contracted: null,
        }}
      />,
    );

    expect(screen.getByText("Profissional")).toBeInTheDocument();
  });

  it("renders disabled action without tooltip when no reason provided", () => {
    getPresentationMock.mockReturnValue(
      presentation({
        primaryAction: {
          label: "Ver orçamentos",
          intent: "budgets",
          disabled: true,
        },
        secondaryAction: null,
      }),
    );

    render(<ClientServiceListCard model={model} />);

    expect(screen.getByRole("button", { name: "Ver orçamentos" })).toBeDisabled();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
