// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ServiceModel } from "@/features/view-services";
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

    it("shows expired proposal highlight", () => {
      const model = baseModel({
        myProposal: {
          id: "p-1",
          status: "EXPIRED",
          finalAmount: 200,
          updatedAt: "2025-03-04T00:00:00Z",
          expiredAt: "2025-03-03T00:00:00Z",
          submittedAt: "2025-03-01T00:00:00Z",
          revisionReason: null,
          revisionNotes: null,
          clientRejectionResponse: null,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.title).toBe("Proposta expirada");
      expect(pres.highlight.detail).toMatch(/Proposta expirada em/);
      expect(pres.highlight.emphasis).toBe("attention");
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
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 5,
          scheduledStartDate: "2025-06-08",
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          chatId: null,
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
      expect(pres.primaryAction.label).toBe("Abrir no mapa");
      expect(pres.primaryAction.intent).toBe("open_map");
      expect(pres.primaryAction.disabled).toBe(true);
    });

    it("highlights pending payment with charge timing for the provider", () => {
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
          scheduledStartDate: "2025-06-15",
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          chatId: null,
          updatedAt: null,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight.icon).toBe("payment_pending");
      expect(pres.highlight.title).toBe("Aguardando pagamento do cliente");
      expect(pres.highlight.detail).toBe(
        "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
      );
      expect(pres.highlight.emphasis).toBe("attention");
    });

    it("enables Abrir no mapa when today service has coordinates", () => {
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
          scheduledShift: "morning",
          provider: null,
          chatId: null,
          updatedAt: null,
        },
        address: {
          neighborhood: "Centro",
          cityName: "Florianópolis",
          street: "Rua das Flores",
          number: "100",
          streetSummary: "Rua das Flores, 100",
          latitude: -27.5954,
          longitude: -48.548,
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.primaryAction.label).toBe("Abrir no mapa");
      expect(pres.primaryAction.disabled).toBe(false);
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
          chatId: null,
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
    it("omits highlight and shows amount, date and mock rating", () => {
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
          chatId: null,
          updatedAt: "2025-06-10T00:00:00Z",
        },
      });
      const pres = getProviderServiceCardPresentation(model);
      expect(pres.highlight).toBeNull();
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

    it("uses contract and rejected-proposal cancel reasons", () => {
      expect(
        getProviderServiceCardPresentation(
          baseModel({
            listPhase: "cancelled",
            statusTabId: "cancelled",
            requestStatus: "OPEN",
            contracted: {
              id: "cs-1",
              status: "CANCELLED",
              agreedSlot: null,
              durationUnit: "hours",
              durationValue: 2,
              scheduledStartDate: null,
              scheduledEndDate: null,
              scheduledShift: null,
              provider: null,
              chatId: null,
              updatedAt: "2025-06-05T00:00:00Z",
            },
          }),
        ).highlight.detail,
      ).toBe("Serviço cancelado");

      expect(
        getProviderServiceCardPresentation(
          baseModel({
            listPhase: "cancelled",
            statusTabId: "cancelled",
            requestStatus: "OPEN",
            myProposal: {
              id: "p-1",
              status: "REJECTED",
              finalAmount: 200,
              updatedAt: "2025-06-05T00:00:00Z",
              expiredAt: null,
              submittedAt: "2025-06-01T00:00:00Z",
              revisionReason: null,
              revisionNotes: null,
              clientRejectionResponse: null,
            },
          }),
        ).highlight.detail,
      ).toBe("Cliente optou por outro profissional");
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

describe("getProviderServiceCardPresentation additional branches", () => {
  function proposal(
    overrides: Partial<NonNullable<ServiceModel["myProposal"]>> = {},
  ): NonNullable<ServiceModel["myProposal"]> {
    return {
      id: "p-1",
      status: "PENDING",
      finalAmount: 250,
      updatedAt: "2025-03-02T00:00:00Z",
      expiredAt: null,
      submittedAt: "2025-03-02T00:00:00Z",
      revisionReason: null,
      revisionNotes: null,
      clientRejectionResponse: null,
      ...overrides,
    };
  }

  function contracted(
    overrides: Partial<NonNullable<ServiceModel["contracted"]>> = {},
  ): NonNullable<ServiceModel["contracted"]> {
    return {
      id: "cs-1",
      status: "CONFIRMED",
      agreedSlot: null,
      durationUnit: "hours",
      durationValue: 2,
      scheduledStartDate: "2025-06-15",
      scheduledEndDate: null,
      scheduledShift: "morning",
      provider: null,
      chatId: null,
      updatedAt: null,
      ...overrides,
    };
  }

  it("omits proposal amount when final amount is missing", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({ hasPendingProposal: true, myProposal: proposal({ finalAmount: null }) }),
    );

    expect(pres.secondaryInfo.some((item) => item.icon === "amount")).toBe(false);
  });

  it("omits location when address is missing", () => {
    const pres = getProviderServiceCardPresentation(baseModel({ address: null }));

    expect(pres.secondaryInfo.some((item) => item.icon === "location")).toBe(false);
  });

  it("uses the client rejection response as the cancellation reason", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        myProposal: proposal({
          status: "REJECTED",
          clientRejectionResponse: "O cliente alterou os planos",
        }),
      }),
    );

    expect(pres.highlight.detail).toBe("O cliente alterou os planos");
  });

  it("omits revision reason details when none were supplied", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        myProposal: proposal({ status: "REVISION_REQUESTED", revisionReason: null }),
      }),
    );

    expect(pres.highlight.title).toBe("Cliente solicitou revisão");
    expect(pres.secondaryInfo.some((item) => item.icon === "tag")).toBe(false);
  });

  it("treats revised proposals as pending client decisions", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({ myProposal: proposal({ status: "REVISED" }) }),
    );

    expect(pres.highlight.title).toBe("Aguardando decisão do cliente sobre sua proposta");
    expect(pres.primaryAction.intent).toBe("view_proposal");
  });

  it("shows an expiring warning without a submission date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T00:00:00Z"));

    try {
      const pres = getProviderServiceCardPresentation(
        baseModel({
          hasPendingProposal: true,
          myProposal: proposal({
            submittedAt: null,
            updatedAt: null,
            expiredAt: "2025-03-03T00:00:00Z",
          }),
        }),
      );

      expect(pres.highlight.detail).toBe("Sua proposta expira em breve");
      expect(pres.highlight.emphasis).toBe("attention");
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits pending proposal timing without submission or expiration", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        hasPendingProposal: true,
        myProposal: proposal({ submittedAt: null, updatedAt: null, expiredAt: null }),
      }),
    );

    expect(pres.highlight.detail).toBeUndefined();
    expect(pres.highlight.emphasis).toBe("default");
  });

  it("omits relative interaction detail when chat has no timestamp", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: null,
          lastMessagePreview: null,
        },
      }),
    );

    expect(pres.highlight.title).toBe("Negociação em andamento");
    expect(pres.highlight.detail).toBeUndefined();
  });

  it("prompts a provider to start chatting when no chat or proposal exists", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({ chatSummary: null, myProposal: null, hasPendingProposal: false }),
    );

    expect(pres.highlight.title).toBe("Inicie a conversa com o cliente");
  });

  it("uses a future scheduled highlight for in-progress work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));

    try {
      const pres = getProviderServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          contracted: contracted({ scheduledStartDate: "2025-06-15" }),
        }),
      );

      expect(pres.isTodayService).toBe(false);
      expect(pres.highlight.icon).toBe("scheduled");
    } finally {
      vi.useRealTimers();
    }
  });

  it("prioritizes unread chat over pending payment", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contracted: contracted({ status: "PENDING_PAYMENT" }),
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: null,
          lastMessagePreview: "Olá",
        },
      }),
    );

    expect(pres.highlight.icon).toBe("new_message");
  });

  it("falls back to contract update date for completion", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: null,
        contracted: contracted({ status: "COMPLETED", updatedAt: "2025-06-10T12:00:00Z" }),
      }),
    );

    expect(pres.secondaryInfo).toContainEqual({ icon: "date", text: "Concluído em 10/06/2025" });
  });

  it("omits cancellation date when no timestamp is available", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        cancelledAt: null,
        contracted: null,
      }),
    );

    expect(pres.highlight.subdetail).toBeUndefined();
  });

  it("disables chat when the summary has no id", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        chatSummary: {
          id: null,
          isUnread: false,
          lastInteractionAt: null,
          lastMessagePreview: null,
        },
      }),
    );

    expect(pres.primaryAction).toMatchObject({ intent: "chat", disabled: true });
  });

  it("disables navigation for today's service without coordinates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-08T12:00:00Z"));

    try {
      const pres = getProviderServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          address: { neighborhood: "Centro", cityName: "Florianópolis" },
          contracted: contracted({ scheduledStartDate: "2025-06-08" }),
        }),
      );

      expect(pres.primaryAction).toMatchObject({
        intent: "open_map",
        disabled: true,
        disabledReason: "Localização do serviço indisponível",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("omits neighborhood label when address parts are blank", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        address: { neighborhood: "", cityName: "" },
      }),
    );
    expect(pres.secondaryInfo.some((item) => item.icon === "location" && item.text)).toBe(false);
  });

  it("handles completed service without any closed timestamp", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: null,
        contracted: contracted({ status: "COMPLETED", updatedAt: null }),
      }),
    );
    expect(pres.secondaryInfo.some((item) => item.text.includes("Concluído em"))).toBe(true);
  });

  it("hides urgency for null urgency", () => {
    expect(getProviderServiceCardPresentation(baseModel({ urgency: null })).showUrgency).toBe(
      false,
    );
  });

  it("falls back to neighborhood city in in-progress when full address is empty", () => {
    const pres = getProviderServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        address: { neighborhood: "Centro", cityName: "Florianópolis", streetSummary: "" },
        contracted: contracted({ scheduledStartDate: "2099-06-15" }),
      }),
    );
    expect(
      pres.secondaryInfo.some((item) => item.text?.includes("Centro, Florianópolis")),
    ).toBe(true);
  });
});
