import { describe, expect, it } from "vitest";
import type { ServiceModel } from "../../types/service.types";
import {
  getClientServiceNextStep,
  getProviderServiceNextStep,
} from "../serviceNextStep";

function baseModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Serviço de teste",
    description: null,
    descriptionPreview: "",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    contractedServiceId: null,
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    requestStatus: "OPEN",
    cancelledAt: null,
    completedAt: null,
    address: { neighborhood: "Centro", cityName: "Florianópolis" },
    service: { title: "Eletricista", slug: "eletricista" },
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
    enrichmentStatus: null,
    enrichmentReady: false,
    ...overrides,
  };
}

function contracted(
  overrides: Partial<NonNullable<ServiceModel["contracted"]>> = {},
): NonNullable<ServiceModel["contracted"]> {
  return {
    id: "cs-1",
    status: "PENDING_PAYMENT",
    agreedSlot: null,
    durationUnit: "hours",
    durationValue: 2,
    scheduledStartDate: "2025-06-15",
    scheduledEndDate: null,
    scheduledShift: "morning",
    provider: null,
    chatId: "chat-1",
    updatedAt: null,
    paymentScheduleState: "SCHEDULED",
    ...overrides,
  };
}

describe("getClientServiceNextStep", () => {
  it("returns payment next step only for FAILED_PERMANENT", () => {
    const step = getClientServiceNextStep(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-1",
        contracted: contracted({ paymentScheduleState: "FAILED_PERMANENT" }),
      }),
    );

    expect(step).toMatchObject({
      intent: "adjust_payment",
      eyebrow: "Próximo passo",
      title: "Pagamento pendente",
      actionLabel: "Pagar agora",
      trustFooter: { icon: "lock", text: "Ambiente seguro e criptografado" },
    });
  });

  it("returns null for non-permanent pending payment without unread/chat primary", () => {
    const step = getClientServiceNextStep(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-1",
        contracted: contracted({
          status: "PENDING_PAYMENT",
          paymentScheduleState: "SCHEDULED",
        }),
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: null,
        },
      }),
    );

    // Primary falls through to chat (actionable) when payment is not permanent failure.
    expect(step?.intent).toBe("chat");
  });

  it("returns evaluate step for EXECUTED", () => {
    const step = getClientServiceNextStep(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-1",
        contracted: contracted({ status: "EXECUTED", paymentScheduleState: null }),
      }),
    );

    expect(step).toMatchObject({
      intent: "evaluate_service",
      title: "Aceite a conclusão e avalie o serviço",
      actionLabel: "Avaliar serviço",
    });
  });

  it("returns budgets step with shield footer", () => {
    const step = getClientServiceNextStep(
      baseModel({
        proposalCount: 2,
        pendingProposalCount: 2,
      }),
    );

    expect(step).toMatchObject({
      intent: "budgets",
      trustFooter: { icon: "shield" },
    });
    expect(step?.actionLabel).toBeTruthy();
  });

  it("returns messages/chat for unread negotiation", () => {
    const multi = getClientServiceNextStep(
      baseModel({
        unreadChatCount: 2,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: "Oi",
          providerDisplayName: "João",
        },
      }),
    );
    expect(multi?.intent).toBe("messages");

    const single = getClientServiceNextStep(
      baseModel({
        unreadChatCount: 1,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: "Oi",
          providerDisplayName: "João",
        },
      }),
    );
    expect(single?.intent).toBe("chat");
  });

  it("returns null for waiting / cancelled / completed without rating gap", () => {
    expect(getClientServiceNextStep(baseModel())).toBeNull();

    expect(
      getClientServiceNextStep(
        baseModel({
          listPhase: "cancelled",
          statusTabId: "cancelled",
          requestStatus: "CANCELLED",
        }),
      ),
    ).toBeNull();

    expect(
      getClientServiceNextStep(
        baseModel({
          listPhase: "completed",
          statusTabId: "completed",
          contractedServiceId: "cs-1",
          contracted: contracted({
            status: "COMPLETED",
            clientRatingOverallScore: 5,
            paymentScheduleState: null,
          }),
        }),
      ),
    ).toBeNull();
  });

  it("returns evaluate for completed without rating", () => {
    const step = getClientServiceNextStep(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        contractedServiceId: "cs-1",
        contracted: contracted({
          status: "COMPLETED",
          clientRatingOverallScore: null,
          paymentScheduleState: null,
        }),
      }),
    );
    expect(step?.intent).toBe("evaluate_service");
  });
});

describe("getProviderServiceNextStep", () => {
  it("returns mark_executed when CONFIRMED and past schedule", () => {
    const step = getProviderServiceNextStep(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-1",
        enrichmentReady: true,
        contracted: contracted({
          status: "CONFIRMED",
          scheduledStartDate: "2020-01-01",
          scheduledEndDate: null,
          paymentScheduleState: null,
        }),
      }),
    );

    expect(step).toMatchObject({
      intent: "mark_executed",
      actionLabel: "Concluir serviço",
      disabled: false,
    });
  });

  it("returns revise_proposal for REVISION_REQUESTED", () => {
    const step = getProviderServiceNextStep(
      baseModel({
        myProposal: {
          id: "p-1",
          status: "REVISION_REQUESTED",
          finalAmount: 100,
          updatedAt: "2025-03-01T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-03-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
      }),
    );

    expect(step?.intent).toBe("revise_proposal");
  });

  it("returns null for completed / cancelled / waiting on client confirmation", () => {
    expect(
      getProviderServiceNextStep(
        baseModel({
          listPhase: "completed",
          statusTabId: "completed",
          contractedServiceId: "cs-1",
          contracted: contracted({ status: "COMPLETED", paymentScheduleState: null }),
        }),
      ),
    ).toBeNull();

    expect(
      getProviderServiceNextStep(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          contractedServiceId: "cs-1",
          contracted: contracted({
            status: "EXECUTED",
            paymentScheduleState: null,
          }),
          chatSummary: {
            id: "chat-1",
            isUnread: false,
            lastInteractionAt: "2025-03-02T00:00:00Z",
            lastMessagePreview: null,
          },
        }),
      ),
    ).toBeNull();
  });

  it("does not show payment next step for provider", () => {
    const step = getProviderServiceNextStep(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-1",
        contracted: contracted({
          status: "PENDING_PAYMENT",
          paymentScheduleState: "FAILED_PERMANENT",
        }),
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: null,
        },
      }),
    );

    expect(step?.intent).not.toBe("adjust_payment");
    // Ranking primary is chat for pending payment without unread.
    expect(step?.intent).toBe("chat");
  });
});
