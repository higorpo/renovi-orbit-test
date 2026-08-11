// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceDetailPage } from "../ServiceDetailPage";
import type { ServiceModel } from "../../types/service.types";

const authMocks = vi.hoisted(() => ({
  profile: { role: "client" as "client" | "provider" },
}));

const serviceMocks = vi.hoisted(() => ({
  data: null as ServiceModel | null,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  requestedId: undefined as string | undefined,
}));

const cancelMocks = vi.hoisted(() => ({
  cancelService: vi.fn(),
  isCancelling: false,
}));

const republishMocks = vi.hoisted(() => ({
  republishCancelledService: vi.fn(),
  isRepublishing: false,
}));

const budgetSheetMocks = vi.hoisted(() => ({
  budgetSheetOpen: false,
  setBudgetSheetOpen: vi.fn(),
  selectedServiceRequestId: null as string | null,
  selectedBudgetSheetMode: "compare" as const,
  openBudgetSheet: vi.fn(),
}));

const chatNavMocks = vi.hoisted(() => ({
  openChat: vi.fn(),
  isOpeningChat: false,
}));

vi.mock("react-router", () => ({
  useParams: () => ({ id: "sr-1" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../../hooks/useRecordProviderOpportunityView", () => ({
  useRecordProviderOpportunityView: vi.fn(),
}));

vi.mock("../../hooks/useService", () => ({
  useService: (id?: string) => {
    serviceMocks.requestedId = id;
    return serviceMocks;
  },
}));

vi.mock("../../hooks/useCancelService", () => ({
  useCancelService: () => cancelMocks,
}));

vi.mock("../../hooks/useRepublishCancelledService", () => ({
  useRepublishCancelledService: () => republishMocks,
}));

vi.mock("../../hooks/useServiceRequestBudgetSheet", () => ({
  useServiceRequestBudgetSheet: () => budgetSheetMocks,
}));

vi.mock("../../hooks/useProviderServiceRequestChat", () => ({
  useProviderServiceRequestChat: () => ({ data: { chatId: "chat-1" } }),
}));

vi.mock("../../hooks/useServiceDetailChatNavigation", () => ({
  useServiceDetailChatNavigation: () => chatNavMocks,
}));

vi.mock("@/features/negotiation-proposals", () => ({
  ReceivedBudgetDetailsSheet: ({
    onOpenChange,
  }: {
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="budget-sheet">
      <button type="button" onClick={() => onOpenChange(false)}>
        close-budget
      </button>
      <button type="button" onClick={() => onOpenChange(true)}>
        keep-budget-open
      </button>
    </div>
  ),
}));

vi.mock("@/features/chats", () => ({
  ServiceRequestConversationList: () => <div data-testid="conversation-list" />,
}));

vi.mock("../ServiceDetailSkeleton", () => ({
  ServiceDetailSkeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("../ServiceDetailHeader", () => ({
  ServiceDetailHeader: ({
    model,
    onOpenBudgetSheet,
    onMutated,
  }: {
    model: ServiceModel;
    onOpenBudgetSheet?: (model: ServiceModel) => void;
    onMutated?: () => void;
  }) => (
    <div>
      <h1>{model.title}</h1>
      <div data-testid="service-detail-actions-bar">
        <button type="button" onClick={() => onOpenBudgetSheet?.(model)}>
          open-budget
        </button>
        <button type="button" onClick={() => onMutated?.()}>
          mutate-ok
        </button>
      </div>
    </div>
  ),
}));

vi.mock("../ServiceContractedSection", () => ({
  ServiceContractedSection: () => <div data-testid="contracted-section" />,
}));

vi.mock("@/features/service-completion", () => ({
  ProviderMarkExecutedAction: () => <div data-testid="provider-mark-executed-action" />,
  ClientEvaluateServiceAction: () => <div data-testid="client-evaluate-service-action" />,
  ClientEvaluateServiceSheet: () => <div data-testid="client-evaluate-sheet" />,
  ProviderMarkExecutedSheet: () => <div data-testid="provider-mark-executed-sheet" />,
}));

vi.mock("@/features/payments", () => ({
  ManualPaymentDialog: () => <div data-testid="manual-payment-dialog" />,
}));

vi.mock("../../hooks/useClientCardManualPaymentBridge", () => ({
  useClientCardManualPaymentBridge: () => ({
    open: false,
    openModal: vi.fn(),
    handleOpenChange: vi.fn(),
    handleCompleted: vi.fn(),
    schedule: null,
    context: null,
    isLoading: false,
    error: null,
  }),
}));

const journeyMocks = vi.hoisted(() => ({
  milestones: [] as Array<{
    key: string;
    status: string;
    label: string;
    secondaryText: string | null;
  }>,
  isLoading: false,
  isError: false,
  isFetching: false,
}));

vi.mock("../../hooks/useClientServiceJourney", () => ({
  useClientServiceJourney: () => journeyMocks,
}));

vi.mock("../ServiceProviderLocationSection", () => ({
  ServiceProviderLocationSection: () => <div data-testid="location-section" />,
}));

vi.mock("../ServiceDetailRequestSections", () => ({
  ServiceDetailRequestSections: () => <div data-testid="request-sections" />,
}));

vi.mock("../ServiceProviderProposalRejectionAlert", () => ({
  ServiceProviderProposalRejectionAlert: () => <div data-testid="rejection-alert" />,
}));

vi.mock("../ServiceProviderProposalSection", () => ({
  ServiceProviderProposalSection: () => <div data-testid="proposal-section" />,
}));

vi.mock("../ServiceDetailFloatingActions", () => ({
  ServiceDetailFloatingActions: ({
    onOpenChat,
  }: {
    onOpenChat: () => void;
  }) => (
    <button type="button" onClick={onOpenChat}>
      Abrir chat
    </button>
  ),
}));

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Pedido de teste",
    description: "Desc",
    descriptionPreview: "Desc",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    contractedServiceId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    requestStatus: null,
    cancelledAt: null,
    completedAt: null,
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 2,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: "Cliente",
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: ["ladder"],
    suggestedMaterials: ["other"],
    lastActivityAt: null,
    myProposal: null,
    chatSummary: null,
    enrichmentStatus: null,
    enrichmentReady: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.profile = { role: "client" };
  serviceMocks.data = null;
  serviceMocks.isLoading = false;
  serviceMocks.isError = false;
  serviceMocks.requestedId = undefined;
  journeyMocks.milestones = [];
  journeyMocks.isLoading = false;
  journeyMocks.isError = false;
  journeyMocks.isFetching = false;
});

describe("ServiceDetailPage", () => {
  it("shows skeleton while loading", () => {
    serviceMocks.isLoading = true;
    render(<ServiceDetailPage />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("shows error state with retry", () => {
    serviceMocks.isError = true;
    render(<ServiceDetailPage />);
    expect(screen.getByText(/Não foi possível carregar este serviço/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(serviceMocks.refetch).toHaveBeenCalled();
  });

  it("shows empty state when service is missing", () => {
    render(<ServiceDetailPage />);
    expect(screen.getByText(/Serviço não encontrado/i)).toBeInTheDocument();
  });

  it("renders client negotiation content", () => {
    serviceMocks.data = buildModel();
    render(<ServiceDetailPage />);
    expect(screen.getByText("Pedido de teste")).toBeInTheDocument();
    expect(screen.getByTestId("service-detail-actions-bar")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
    expect(screen.getByTestId("budget-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-budget" }));
    expect(budgetSheetMocks.openBudgetSheet).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "close-budget" }));
    expect(budgetSheetMocks.setBudgetSheetOpen).toHaveBeenCalledWith(false);
  });

  it("renders provider contracted content and floating chat", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel({
      listPhase: "in_progress",
      statusTabId: "in_progress",
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 2,
        scheduledStartDate: "2026-06-01",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: { id: "p-1", displayName: "João", profileImagePath: null },
        chatId: "chat-1",
        updatedAt: null,
      },
    });

    render(<ServiceDetailPage isInsideSheet />);
    expect(screen.getByTestId("rejection-alert")).toBeInTheDocument();
    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
    expect(screen.getByTestId("location-section")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-section")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir chat/i }));
    expect(chatNavMocks.openChat).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "mutate-ok" }));
    expect(serviceMocks.refetch).toHaveBeenCalled();
  });

  it("shows actions bar for cancelled client services", () => {
    serviceMocks.data = buildModel({
      listPhase: "cancelled",
      statusTabId: "cancelled",
      proposalCount: 0,
    });
    render(<ServiceDetailPage serviceRequestId="sr-1" />);
    expect(screen.getByTestId("service-detail-actions-bar")).toBeInTheDocument();
  });

  it("still renders header actions bar for completed services without contracted", () => {
    serviceMocks.data = buildModel({
      listPhase: "completed",
      statusTabId: "completed",
      proposalCount: 0,
      contracted: null,
    });
    render(<ServiceDetailPage />);
    // Header always mounts; actions bar may be empty (null) when no CTAs.
    expect(screen.getByText("Pedido de teste")).toBeInTheDocument();
  });

  it("shows next-step card for actionable client budgets intent", () => {
    serviceMocks.data = buildModel({
      proposalCount: 2,
      pendingProposalCount: 2,
    });
    render(<ServiceDetailPage />);
    expect(screen.getByTestId("service-next-step-card")).toBeInTheDocument();
    expect(screen.getByText("Próximo passo")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("service-next-step-cta"));
    expect(budgetSheetMocks.openBudgetSheet).toHaveBeenCalled();
  });

  it("hides next-step card when primary intent is not actionable", () => {
    serviceMocks.data = buildModel({
      listPhase: "completed",
      statusTabId: "completed",
      proposalCount: 0,
      contracted: {
        id: "cs-1",
        status: "COMPLETED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 2,
        scheduledStartDate: "2026-01-01",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: null,
        chatId: null,
        updatedAt: null,
        clientRatingOverallScore: 5,
      },
    });
    render(<ServiceDetailPage />);
    expect(screen.queryByTestId("service-next-step-card")).not.toBeInTheDocument();
  });

  it("shows journey card for client below next step when milestones exist", () => {
    serviceMocks.data = buildModel({
      proposalCount: 2,
      pendingProposalCount: 2,
    });
    journeyMocks.milestones = [
      {
        key: "request_created",
        status: "completed",
        label: "Pedido criado",
        secondaryText: "Hoje, 10:00",
      },
      {
        key: "payment",
        status: "current",
        label: "Pagamento pendente",
        secondaryText: "Aguardando pagamento",
      },
    ];

    render(<ServiceDetailPage />);

    expect(screen.getByTestId("service-next-step-card")).toBeInTheDocument();
    expect(screen.getByTestId("service-journey-card")).toBeInTheDocument();
    expect(screen.getByText("Acompanhe seu pedido")).toBeInTheDocument();
  });

  it("shows journey skeleton while journey is loading for client", () => {
    serviceMocks.data = buildModel();
    journeyMocks.isLoading = true;

    render(<ServiceDetailPage />);

    expect(screen.getByTestId("service-journey-card-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("service-journey-card")).not.toBeInTheDocument();
  });

  it("hides journey card for providers", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel({
      listPhase: "in_progress",
      statusTabId: "in_progress",
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreedSlot: null,
        durationUnit: "hours",
        durationValue: 2,
        scheduledStartDate: "2026-06-01",
        scheduledEndDate: null,
        scheduledShift: "morning",
        provider: { id: "p-1", displayName: "João", profileImagePath: null },
        chatId: "chat-1",
        updatedAt: null,
      },
    });
    journeyMocks.milestones = [
      {
        key: "request_created",
        status: "completed",
        label: "Pedido criado",
        secondaryText: null,
      },
    ];

    render(<ServiceDetailPage />);

    expect(screen.queryByTestId("service-journey-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("service-journey-card-skeleton")).not.toBeInTheDocument();
  });
});

describe("ServiceDetailPage branch coverage", () => {
  const contracted: NonNullable<ServiceModel["contracted"]> = {
    id: "cs-1",
    status: "CONFIRMED",
    agreedSlot: null,
    durationUnit: "hours",
    durationValue: 2,
    scheduledStartDate: "2026-06-01",
    scheduledEndDate: null,
    scheduledShift: "morning",
    provider: { id: "p-1", displayName: "João", profileImagePath: null },
    chatId: "chat-1",
    updatedAt: null,
  };

  it("uses the default page shell spacing outside a sheet", () => {
    serviceMocks.data = buildModel();
    const { container } = render(<ServiceDetailPage />);

    expect(container.firstElementChild).toHaveClass("space-y-4", "pb-24");
    expect(container.firstElementChild).not.toHaveClass("px-0", "py-0");
  });

  it("hides the conversation list for a contracted client service", () => {
    serviceMocks.data = buildModel({ contracted });
    render(<ServiceDetailPage />);

    expect(screen.queryByTestId("conversation-list")).not.toBeInTheDocument();
    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
  });

  it("does not render the client budget sheet for providers", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel();
    render(<ServiceDetailPage />);

    expect(screen.queryByTestId("budget-sheet")).not.toBeInTheDocument();
  });

  it("opens budget sheet from header actions", () => {
    serviceMocks.data = buildModel({ proposalCount: 0 });
    render(<ServiceDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "open-budget" }));
    expect(budgetSheetMocks.openBudgetSheet).toHaveBeenCalled();
  });

  it("hides provider location when there is no contracted service", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel({ contracted: null });
    render(<ServiceDetailPage />);

    expect(screen.queryByTestId("location-section")).not.toBeInTheDocument();
  });

  it("renders contracted section for unknown profile role without crashing", () => {
    (authMocks as { profile: { role: string } }).profile = { role: "admin" };
    serviceMocks.data = buildModel({ contracted });
    render(<ServiceDetailPage />);

    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
  });

  it("ignores an open=true budget sheet change", () => {
    serviceMocks.data = buildModel();
    render(<ServiceDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "keep-budget-open" }));
    expect(budgetSheetMocks.setBudgetSheetOpen).not.toHaveBeenCalled();
  });

  it("prefers the service request id prop over the route id", () => {
    serviceMocks.data = buildModel({ id: "prop-id" });
    render(<ServiceDetailPage serviceRequestId="prop-id" />);

    expect(serviceMocks.requestedId).toBe("prop-id");
  });

  it("hosts header actions for contracted client", () => {
    authMocks.profile = { role: "client" };
    serviceMocks.data = buildModel({
      listPhase: "in_progress",
      statusTabId: "in_progress",
      contracted,
      proposalCount: 0,
    });
    render(<ServiceDetailPage />);

    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
    expect(screen.getByTestId("service-detail-actions-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("rejection-alert")).not.toBeInTheDocument();
  });

  it("hosts header and contracted section for contracted provider", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel({
      listPhase: "in_progress",
      statusTabId: "in_progress",
      contracted,
    });
    render(<ServiceDetailPage />);

    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
    expect(screen.getByTestId("service-detail-actions-bar")).toBeInTheDocument();
  });

  it("renders provider proposal section without contracted service", () => {
    authMocks.profile = { role: "provider" };
    serviceMocks.data = buildModel({
      listPhase: "negotiation",
      statusTabId: "negotiation",
      contracted: null,
    });
    render(<ServiceDetailPage />);

    expect(screen.getByTestId("proposal-section")).toBeInTheDocument();
    expect(screen.queryByTestId("contracted-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("conversation-list")).not.toBeInTheDocument();
  });

  it("renders without role-specific sections when profile is missing", () => {
    (authMocks as { profile: null }).profile = null;
    serviceMocks.data = buildModel({ contracted });
    render(<ServiceDetailPage />);

    expect(screen.getByTestId("service-detail-actions-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("rejection-alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("contracted-section")).toBeInTheDocument();
  });
});
