// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { getClientServiceCardPresentation } from "../clientServiceCardPresentation";

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
    ...overrides,
  };
}

describe("getClientServiceCardPresentation", () => {
  it("prioritizes unread messages across multiple chats", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        unreadChatCount: 2,
        activeChatCount: 3,
        proposalCount: 2,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: "Olá!",
          providerDisplayName: "João",
        },
      }),
    );

    expect(pres.highlight.title).toBe("Mensagens novas de prestadores");
    expect(pres.highlight.detail).toBe("2 conversas com mensagens novas");
    expect(pres.showProviderHeader).toBe(false);
    expect(pres.primaryAction.label).toBe("Ver mensagens");
    expect(pres.primaryAction.intent).toBe("messages");
  });

  it("opens direct chat when a single provider sent an unread message", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        unreadChatCount: 1,
        activeChatCount: 1,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: "Olá!",
          providerDisplayName: "João",
        },
      }),
    );

    expect(pres.highlight.title).toBe("Nova mensagem de João");
    expect(pres.primaryAction.label).toBe("Ver mensagem");
    expect(pres.primaryAction.intent).toBe("chat");
  });

  it("shows full address in secondary info across all phases", () => {
    const fullAddressModel = {
      neighborhood: "Centro",
      cityName: "Florianópolis",
      streetSummary: "Rua das Flores, 123",
      stateAbbreviation: "SC",
    };

    const negotiation = getClientServiceCardPresentation(
      baseModel({ address: fullAddressModel }),
    );
    expect(
      negotiation.secondaryInfo.some((item) =>
        item.text.includes("Serviço em Rua das Flores, 123 - Centro, Florianópolis (SC)"),
      ),
    ).toBe(true);

    const completed = getClientServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: "2025-06-01T00:00:00Z",
        address: fullAddressModel,
      }),
    );
    expect(
      completed.secondaryInfo.some((item) =>
        item.text.includes("Serviço em Rua das Flores, 123 - Centro, Florianópolis (SC)"),
      ),
    ).toBe(true);

    const cancelled = getClientServiceCardPresentation(
      baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "CANCELLED",
        cancelledAt: "2025-06-01T00:00:00Z",
        address: fullAddressModel,
      }),
    );
    expect(
      cancelled.secondaryInfo.some((item) =>
        item.text.includes("Serviço em Rua das Flores, 123 - Centro, Florianópolis (SC)"),
      ),
    ).toBe(true);
  });

  it("shows compare budgets when multiple pending proposals without unread", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        proposalCount: 3,
        hasPendingProposal: true,
        pendingProposalCount: 2,
        activeChatCount: 2,
      }),
    );

    expect(pres.highlight.title).toBe("Novos orçamentos para analisar");
    expect(pres.primaryAction.label).toBe("Comparar orçamentos");
  });

  it("shows provider header when in progress", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        counterpartyName: "Maria",
        counterparty: {
          id: "p-1",
          displayName: "Maria",
          profileImagePath: null,
        },
        contracted: {
          id: "cs-1",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 2,
          scheduledStartDate: "2025-06-15",
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
          chatId: null,
          updatedAt: null,
        },
      }),
    );

    expect(pres.showProviderHeader).toBe(true);
  });

  it("shows provider chat as primary action when in progress", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-06-10T12:00:00Z",
          lastMessagePreview: "Combinado!",
          providerDisplayName: "Maria",
        },
      }),
    );

    expect(pres.primaryAction).toMatchObject({
      label: "Ver conversa com prestador",
      intent: "chat",
    });
    expect(pres.secondaryAction).toMatchObject({ label: "Ver detalhes", intent: "details" });
  });

  it("shows responder as primary action when in progress with unread chat", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        unreadChatCount: 1,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-06-10T12:00:00Z",
          lastMessagePreview: "Olá!",
          providerDisplayName: "Maria",
        },
      }),
    );

    expect(pres.primaryAction).toMatchObject({ label: "Responder", intent: "chat" });
  });
});
