import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServiceModel } from "@/features/view-services/types/service.types";
import { getProviderServiceCardPresentation } from "../providerServiceCardPresentation";

function baseModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: "sr-1",
    title: "Troca de disjuntor com quedas frequentes de energia",
    description: "Descrição do serviço",
    descriptionPreview: "Descrição do serviço",
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
    counterpartyName: "Maria Silva",
    counterparty: { id: "c-1", displayName: "Maria Silva", profileImagePath: null },
    contracted: null,
    tags: null,
    urgency: "medium",
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: "2025-03-02T12:00:00Z",
    myProposal: null,
    chatSummary: null,
    ...overrides,
  };
}

describe("getProviderServiceCardPresentation", () => {
  describe("negotiation", () => {
    it("prioritizes unread message with preview and Responder action", () => {
      const model = baseModel({
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-03-02T12:00:00Z",
          lastMessagePreview: "Você consegue realizar ainda essa semana?",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Nova mensagem recebida");
      expect(pres.highlight.icon).toBe("new_message");
      expect(pres.highlight.messagePreview).toContain("Você consegue realizar");
      expect(pres.secondaryInfo.some((item) => item.text.includes("Você consegue realizar"))).toBe(
        false,
      );
      expect(pres.secondaryInfo.some((item) => item.text.includes("Serviço em Centro"))).toBe(
        true,
      );
      expect(pres.secondaryInfo.some((item) => item.icon === "amount")).toBe(false);
      expect(pres.primaryAction).toMatchObject({ label: "Responder", intent: "chat" });
      expect(pres.secondaryAction).toMatchObject({ label: "Ver detalhes", intent: "details" });
    });

    it("shows pending proposal with submitted date in highlight and amount in secondary", () => {
      const model = baseModel({
        hasPendingProposal: true,
        myProposal: {
          id: "p-1",
          status: "PENDING",
          finalAmount: 425,
          updatedAt: "2025-03-02T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-03-02T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: null,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Aguardando decisão do cliente sobre sua proposta");
      expect(pres.highlight.icon).toBe("waiting");
      expect(pres.highlight.detail).toMatch(/Proposta enviada em/i);
      expect(pres.highlight.subdetail).toBeUndefined();
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "amount" && item.text.includes("Você recebe") && item.text.includes("425"),
        ),
      ).toBe(true);
      expect(pres.secondaryInfo.some((item) => item.text.includes("Serviço em Centro"))).toBe(true);
      expect(pres.primaryAction.label).toBe("Ver proposta");
    });

    it("shows revision insight with reason label only", () => {
      const model = baseModel({
        myProposal: {
          id: "p-1",
          status: "REVISION_REQUESTED",
          finalAmount: 300,
          updatedAt: "2025-03-02T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-03-01T00:00:00Z",
          revisionReason: "PRICE_TOO_HIGH",
          revisionNotes: "O valor ficou acima do orçamento que eu esperava.",
          clientRejectionResponse: null,
        },
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-03-02T00:00:00Z",
          lastMessagePreview: null,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Cliente solicitou revisão");
      expect(pres.highlight.icon).toBe("revision");
      expect(pres.secondaryInfo.some((item) => item.text.includes("Preço alto"))).toBe(true);
      expect(pres.secondaryInfo.some((item) => item.text.includes("orçamento"))).toBe(false);
      expect(pres.secondaryInfo.some((item) => item.text.includes("Serviço em Centro"))).toBe(true);
      expect(pres.primaryAction.label).toBe("Revisar proposta");
    });

    it("shows conversation in progress when chat exists without unread", () => {
      const model = baseModel({
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-03-02T12:00:00Z",
          lastMessagePreview: "Ok, combinado",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Negociação em andamento");
      expect(pres.highlight.icon).toBe("conversation");
      expect(pres.secondaryInfo.some((item) => item.text.includes("Centro"))).toBe(false);
      expect(pres.primaryAction.label).toBe("Ver negociação");
    });

    it("marks expiring proposal with attention emphasis", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-03-01T00:00:00Z"));
      const model = baseModel({
        hasPendingProposal: true,
        myProposal: {
          id: "p-1",
          status: "PENDING",
          finalAmount: 200,
          updatedAt: "2025-03-01T00:00:00Z",
          expiredAt: "2025-03-03T00:00:00Z",
          submittedAt: "2025-03-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.emphasis).toBe("attention");
      expect(pres.highlight.detail).toMatch(/Proposta enviada em/i);
      expect(pres.highlight.detail).toMatch(/expira em breve/i);
      expect(pres.highlight.subdetail).toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe("in_progress", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows today highlight and marks card as today service", () => {
      const model = baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        myProposal: {
          id: "p-1",
          status: "ACCEPTED",
          finalAmount: 425,
          updatedAt: "2025-06-08T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-06-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
        contracted: {
          id: "cs-1",
          status: "PENDING_PAYMENT",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 5,
          scheduledStartDate: "2025-06-08",
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          updatedAt: null,
        },
        address: {
          neighborhood: "Centro",
          cityName: "Florianópolis",
          street: "Rua das Flores",
          number: "100",
          streetSummary: "Rua das Flores, 100",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toMatch(/Serviço hoje/i);
      expect(pres.highlight.icon).toBe("today");
      expect(pres.isTodayService).toBe(true);
      expect(pres.secondaryInfo.some((item) => item.text.includes("Serviço em Rua das Flores"))).toBe(
        true,
      );
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "amount" && item.text.includes("Você recebe"),
        ),
      ).toBe(true);
      expect(pres.primaryAction.label).toBe("Ver conversa");
    });

    it("prioritizes unread message with location, amount and schedule in secondary info", () => {
      const model = baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        myProposal: {
          id: "p-1",
          status: "ACCEPTED",
          finalAmount: 425,
          updatedAt: "2025-06-08T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-06-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
        contracted: {
          id: "cs-1",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 5,
          scheduledStartDate: "2025-06-08",
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: null,
          updatedAt: null,
        },
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-06-08T12:00:00Z",
          lastMessagePreview: "Confirmado para hoje à tarde?",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Nova mensagem recebida");
      expect(pres.highlight.messagePreview).toContain("Confirmado para hoje");
      expect(pres.isTodayService).toBe(true);
      expect(pres.secondaryInfo.some((item) => item.icon === "location")).toBe(true);
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "amount" && item.text.includes("Você recebe"),
        ),
      ).toBe(true);
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "date" && item.text.includes("Serviço hoje"),
        ),
      ).toBe(true);
      expect(pres.secondaryInfo).toHaveLength(3);
      expect(pres.primaryAction).toMatchObject({ label: "Responder", intent: "chat" });
      expect(pres.secondaryAction).toMatchObject({ label: "Ver detalhes", intent: "details" });
    });
  });

  describe("completed", () => {
    it("shows completed highlight with mock rating", () => {
      const model = baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: "2025-06-10T00:00:00Z",
        myProposal: {
          id: "p-1",
          status: "ACCEPTED",
          finalAmount: 425,
          updatedAt: "2025-06-10T00:00:00Z",
          expiredAt: null,
          submittedAt: "2025-06-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
        contracted: {
          id: "cs-1",
          status: "COMPLETED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 5,
          scheduledStartDate: "2025-06-08",
          scheduledEndDate: null,
          scheduledShift: "full_day",
          provider: null,
          updatedAt: "2025-06-10T00:00:00Z",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Serviço concluído");
      expect(pres.highlight.icon).toBe("completed");
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "amount" && item.text.includes("Você recebe"),
        ),
      ).toBe(true);
      expect(
        pres.secondaryInfo.some(
          (item) => item.icon === "date" && item.text.includes("Concluído em"),
        ),
      ).toBe(true);
      expect(pres.secondaryInfo.some((item) => item.icon === "rating")).toBe(true);
      expect(pres.primaryAction.label).toBe("Ver detalhes");
      expect(pres.secondaryAction).toBeNull();
    });
  });

  describe("cancelled", () => {
    it("shows cancelled highlight with reason", () => {
      const model = baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "CANCELLED",
        cancelledAt: "2025-06-05T00:00:00Z",
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Serviço cancelado");
      expect(pres.highlight.icon).toBe("cancelled");
      expect(pres.highlight.emphasis).toBe("cancelled");
      expect(pres.highlight.detail).toContain("desistiu");
      expect(pres.highlight.subdetail).toMatch(/Cancelado em/i);
      expect(pres.secondaryInfo).toHaveLength(0);
    });
  });

  describe("urgency", () => {
    it("shows urgency only for high urgency", () => {
      expect(getProviderServiceCardPresentation(baseModel({ urgency: "high" })).showUrgency).toBe(
        true,
      );
      expect(getProviderServiceCardPresentation(baseModel({ urgency: "medium" })).showUrgency).toBe(
        false,
      );
    });
  });
});
