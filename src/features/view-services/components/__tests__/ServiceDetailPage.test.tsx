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
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../../hooks/useRecordProviderOpportunityView", () => ({
  useRecordProviderOpportunityView: vi.fn(),
}));

vi.mock("../../hooks/useService", () => ({
  useService: () => serviceMocks,
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
    <button type="button" data-testid="budget-sheet" onClick={() => onOpenChange(false)}>
      close-budget
    </button>
  ),
}));

vi.mock("@/features/chats", () => ({
  ServiceRequestConversationList: () => <div data-testid="conversation-list" />,
}));

vi.mock("../ServiceDetailSkeleton", () => ({
  ServiceDetailSkeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("../ServiceDetailHeader", () => ({
  ServiceDetailHeader: ({ model }: { model: ServiceModel }) => (
    <h1>{model.title}</h1>
  ),
}));

vi.mock("../ServiceDetailClientActions", () => ({
  ServiceDetailClientActions: (props: {
    onOpenBudgetSheet: () => void;
    onCancelService: () => void;
    onRepublishService: () => void;
    onCancelDialogOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="client-actions">
      <button type="button" onClick={props.onOpenBudgetSheet}>
        open-budget
      </button>
      <button type="button" onClick={props.onCancelService}>
        cancel-service
      </button>
      <button type="button" onClick={props.onRepublishService}>
        republish-service
      </button>
      <button type="button" onClick={() => props.onCancelDialogOpenChange(true)}>
        open-cancel-dialog
      </button>
    </div>
  ),
}));

vi.mock("../ServiceContractedSection", () => ({
  ServiceContractedSection: (props: {
    onCancellationSuccess?: () => void;
    onCompletionSuccess?: () => void;
    onRescheduleSuccess?: () => void;
  }) => (
    <div data-testid="contracted-section">
      <button type="button" onClick={() => props.onCancellationSuccess?.()}>
        cancel-ok
      </button>
      <button type="button" onClick={() => props.onCompletionSuccess?.()}>
        complete-ok
      </button>
      <button type="button" onClick={() => props.onRescheduleSuccess?.()}>
        reschedule-ok
      </button>
    </div>
  ),
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.profile = { role: "client" };
  serviceMocks.data = null;
  serviceMocks.isLoading = false;
  serviceMocks.isError = false;
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
    expect(screen.getByTestId("client-actions")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-list")).toBeInTheDocument();
    expect(screen.getByTestId("budget-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-budget" }));
    expect(budgetSheetMocks.openBudgetSheet).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "cancel-service" }));
    expect(cancelMocks.cancelService).toHaveBeenCalledWith("sr-1");
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
    fireEvent.click(screen.getByRole("button", { name: "complete-ok" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel-ok" }));
    fireEvent.click(screen.getByRole("button", { name: "reschedule-ok" }));
    expect(serviceMocks.refetch).toHaveBeenCalledTimes(3);
  });

  it("shows republish path for cancelled client services", () => {
    serviceMocks.data = buildModel({
      listPhase: "cancelled",
      statusTabId: "cancelled",
      proposalCount: 0,
    });
    render(<ServiceDetailPage serviceRequestId="sr-1" />);
    expect(screen.getByTestId("client-actions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "republish-service" }));
    expect(republishMocks.republishCancelledService).toHaveBeenCalledWith("sr-1");
  });

  it("hides client actions when there is nothing to show", () => {
    serviceMocks.data = buildModel({
      listPhase: "completed",
      statusTabId: "completed",
      proposalCount: 0,
      contracted: null,
    });
    render(<ServiceDetailPage />);
    expect(screen.queryByTestId("client-actions")).not.toBeInTheDocument();
  });
});
