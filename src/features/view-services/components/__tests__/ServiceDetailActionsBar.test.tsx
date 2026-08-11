// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceDetailActionsBar } from "../ServiceDetailActionsBar";
import type { ServiceModel } from "../../types/service.types";

const cancelServiceMock = vi.fn();
const republishMock = vi.fn();

vi.mock("../../hooks/useCancelService", () => ({
  useCancelService: () => ({
    cancelService: cancelServiceMock,
    isCancelling: false,
  }),
}));

vi.mock("../../hooks/useRepublishCancelledService", () => ({
  useRepublishCancelledService: () => ({
    republishCancelledService: republishMock,
    isRepublishing: false,
  }),
}));

vi.mock("@/features/chats", () => ({
  ServiceRequestContractedChatButton: () => <button type="button">Chat</button>,
}));

vi.mock("@/features/payments", () => ({
  ManualPaymentRecovery: () => <div data-testid="manual-payment" />,
  ContractedServiceCancelAction: () => <div data-testid="cancel-action" />,
}));

vi.mock("@/features/service-reschedule", () => ({
  ContractedServiceRescheduleAction: () => <div data-testid="reschedule-action" />,
}));

vi.mock("@/features/service-completion", () => ({
  ProviderMarkExecutedAction: () => <div data-testid="provider-mark-executed" />,
  ClientEvaluateServiceAction: () => <div data-testid="client-evaluate" />,
}));

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Pedido",
    description: "Desc",
    descriptionPreview: "Desc",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    contractedServiceId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    requestStatus: "OPEN",
    cancelledAt: null,
    completedAt: null,
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 1,
    hasPendingProposal: true,
    pendingProposalCount: 1,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: null,
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: null,
    myProposal: null,
    chatSummary: null,
    enrichmentStatus: null,
    enrichmentReady: false,
    ...overrides,
  };
}

describe("ServiceDetailActionsBar", () => {
  beforeEach(() => {
    cancelServiceMock.mockReset();
    republishMock.mockReset();
  });

  it("renders budget and cancel for client negotiation", () => {
    const onOpenBudgetSheet = vi.fn();
    render(
      <ServiceDetailActionsBar
        model={buildModel()}
        isClient
        isProvider={false}
        onOpenBudgetSheet={onOpenBudgetSheet}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Comparar orçamentos|Ver orçamento/i }));
    expect(onOpenBudgetSheet).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar pedido de serviço" })).toBeInTheDocument();
  });

  it("renders republish for cancelled client request", () => {
    render(
      <ServiceDetailActionsBar
        model={buildModel({ listPhase: "cancelled", statusTabId: "cancelled" })}
        isClient
        isProvider={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Republicar este pedido de serviço" }),
    );
    expect(republishMock).toHaveBeenCalledWith("sr-1");
  });

  it("renders contracted client actions", () => {
    render(
      <ServiceDetailActionsBar
        model={buildModel({
          listPhase: "in_progress",
          contractedServiceId: "cs-1",
          contracted: {
            id: "cs-1",
            status: "EXECUTED",
            agreedSlot: null,
            durationUnit: "hours",
            durationValue: 2,
            scheduledStartDate: "2026-06-10",
            scheduledEndDate: null,
            scheduledShift: "morning",
            provider: { id: "p-1", displayName: "João", profileImagePath: null },
            chatId: "chat-1",
            updatedAt: null,
          },
        })}
        isClient
        isProvider={false}
      />,
    );

    expect(screen.getByTestId("client-evaluate")).toBeInTheDocument();
    expect(screen.getByTestId("manual-payment")).toBeInTheDocument();
    expect(screen.getByTestId("reschedule-action")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-action")).toBeInTheDocument();
  });

  it("renders provider mark-executed for contracted providers", () => {
    render(
      <ServiceDetailActionsBar
        model={buildModel({
          listPhase: "in_progress",
          contractedServiceId: "cs-1",
          contracted: {
            id: "cs-1",
            status: "CONFIRMED",
            agreedSlot: null,
            durationUnit: "hours",
            durationValue: 2,
            scheduledStartDate: "2026-06-10",
            scheduledEndDate: null,
            scheduledShift: "morning",
            provider: null,
            chatId: null,
            updatedAt: null,
          },
        })}
        isClient={false}
        isProvider
      />,
    );

    expect(screen.getByTestId("provider-mark-executed")).toBeInTheDocument();
    expect(screen.queryByTestId("client-evaluate")).not.toBeInTheDocument();
  });
});
