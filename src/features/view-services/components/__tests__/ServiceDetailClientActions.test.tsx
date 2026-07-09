import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { History } from "lucide-react";
import { ServiceDetailClientActions } from "../ServiceDetailClientActions";
import type { ServiceModel } from "../../types/service.types";

vi.mock("@/features/chats", () => ({
  ServiceRequestContractedChatButton: () => <button type="button">Chat</button>,
}));

function buildModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Pedido",
    description: "Desc",
    descriptionPreview: "Desc",
    formData: null,
    formSchema: null,
    listPhase: "cancelled",
    statusTabId: "cancelled",
    contractedServiceId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    requestStatus: "CANCELLED",
    cancelledAt: "2026-01-02T00:00:00Z",
    completedAt: null,
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
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
    ...overrides,
  };
}

describe("ServiceDetailClientActions", () => {
  it("renders republish CTA with exact label when cancelled", () => {
    render(
      <ServiceDetailClientActions
        model={buildModel()}
        budgetAction={null}
        BudgetActionIcon={null}
        showClientBudgetAction={false}
        showClientNegotiationChats={false}
        showContractedChat={false}
        showRepublishAction
        contractedChatId={null}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={vi.fn()}
        onOpenBudgetSheet={vi.fn()}
        onCancelService={vi.fn()}
        onRepublishService={vi.fn()}
        isCancelling={false}
        isRepublishing={false}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Republicar novo pedido de serviço" }),
    ).toBeInTheDocument();
  });

  it("hides republish CTA when showRepublishAction is false", () => {
    render(
      <ServiceDetailClientActions
        model={buildModel({ listPhase: "negotiation", statusTabId: "negotiation" })}
        budgetAction={{
          label: "Ver orçamento",
          sheetMode: "compare",
          disabled: false,
          disabledReason: undefined,
        }}
        BudgetActionIcon={History}
        showClientBudgetAction
        showClientNegotiationChats={false}
        showContractedChat={false}
        showRepublishAction={false}
        contractedChatId={null}
        cancelDialogOpen={false}
        onCancelDialogOpenChange={vi.fn()}
        onOpenBudgetSheet={vi.fn()}
        onCancelService={vi.fn()}
        onRepublishService={vi.fn()}
        isCancelling={false}
        isRepublishing={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Republicar novo pedido de serviço" }),
    ).not.toBeInTheDocument();
  });
});
