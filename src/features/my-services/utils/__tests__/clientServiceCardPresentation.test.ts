// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("highlights pending payment with charge timing for the client", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 8, 12, 0, 0));

    try {
      const pres = getClientServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          contracted: {
            id: "cs-1",
            status: "PENDING_PAYMENT",
            agreedSlot: null,
            durationUnit: "hours",
            durationValue: 2,
            scheduledStartDate: "2025-06-15",
            scheduledEndDate: null,
            scheduledShift: "afternoon",
            provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
            chatId: null,
            updatedAt: null,
            paymentScheduleState: "SCHEDULED",
          },
        }),
      );

      expect(pres.highlight.icon).toBe("payment_pending");
      expect(pres.highlight.title).toBe("Aguardando pagamento");
      expect(pres.highlight.detail).toBe(
        "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
      );
      expect(pres.highlight.emphasis).toBe("attention");
    } finally {
      vi.useRealTimers();
    }
  });

  it("highlights permanent payment failure in red for the client", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contracted: {
          id: "cs-1",
          status: "PENDING_PAYMENT",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 2,
          scheduledStartDate: "2025-06-15",
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
          chatId: null,
          updatedAt: null,
          paymentScheduleState: "FAILED_PERMANENT",
        },
      }),
    );

    expect(pres.highlight.icon).toBe("payment_pending");
    expect(pres.highlight.title).toBe("Pagamento falhou");
    expect(pres.highlight.detail).toBe(
      "Atualize suas informações de pagamento manualmente para confirmar o serviço.",
    );
    expect(pres.highlight.emphasis).toBe("error");
    expect(pres.primaryAction).toMatchObject({
      label: "Ajustar pagamento",
      intent: "adjust_payment",
    });
    expect(pres.secondaryAction).toMatchObject({ label: "Ver detalhes", intent: "details" });
  });

  it("prefers adjust payment over unread chat when payment failed permanently", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        unreadChatCount: 1,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-06-10T12:00:00Z",
          lastMessagePreview: "Oi",
          providerDisplayName: "Maria",
        },
        contracted: {
          id: "cs-1",
          status: "PENDING_PAYMENT",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 2,
          scheduledStartDate: "2025-06-15",
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
          chatId: "chat-1",
          updatedAt: null,
          paymentScheduleState: "FAILED_PERMANENT",
        },
      }),
    );

    expect(pres.primaryAction.intent).toBe("adjust_payment");
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

  it("shows waiting highlight when negotiation has no chats or proposals", () => {
    const pres = getClientServiceCardPresentation(baseModel());

    expect(pres.highlight).toMatchObject({
      icon: "waiting",
      title: "Aguardando profissionais",
      emphasis: "default",
    });
    expect(pres.primaryAction.intent).toBe("details");
  });

  it("shows singular pending proposal highlight", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        proposalCount: 1,
        hasPendingProposal: true,
        pendingProposalCount: 1,
        activeChatCount: 1,
      }),
    );

    expect(pres.highlight.title).toBe("Novo orçamento para analisar");
    expect(pres.highlight.detail).toMatch(/1/);
  });

  it("shows received proposals without pending decision", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        proposalCount: 2,
        hasPendingProposal: false,
        pendingProposalCount: 0,
        activeChatCount: 1,
      }),
    );

    expect(pres.highlight.title).toBe("Orçamentos recebidos");
    expect(pres.primaryAction.intent).toBe("budgets");
  });

  it("shows negotiation in progress when only chats exist", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        activeChatCount: 2,
        lastActivityAt: "2025-06-07T12:00:00Z",
        chatSummary: {
          id: "chat-1",
          isUnread: false,
          lastInteractionAt: "2025-06-07T12:00:00Z",
          lastMessagePreview: "Oi",
          providerDisplayName: "João",
        },
      }),
    );

    expect(pres.highlight.title).toBe("Negociação em andamento");
    expect(pres.highlight.detail).toMatch(/última interação/i);
  });

  it("builds completed presentation without highlight", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: "2025-06-01T00:00:00Z",
        counterpartyName: "Carlos",
        counterparty: {
          id: "p-1",
          displayName: "Carlos",
          profileImagePath: null,
        },
        contracted: {
          id: "cs-1",
          status: "COMPLETED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 2,
          scheduledStartDate: "2025-05-30",
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: { id: "p-1", displayName: "Carlos", profileImagePath: null },
          chatId: null,
          updatedAt: "2025-06-01T00:00:00Z",
        },
      }),
    );

    expect(pres.showProviderHeader).toBe(true);
    expect(pres.highlight).toBeNull();
    expect(pres.secondaryInfo.some((item) => item.text?.includes("Concluído em"))).toBe(true);
    expect(pres.primaryAction.intent).toBe("details");
  });

  it("shows contract cancelled reason when request is not cancelled", () => {
    const pres = getClientServiceCardPresentation(
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
          provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
          chatId: null,
          updatedAt: "2025-06-01T00:00:00Z",
        },
      }),
    );

    expect(pres.highlight.detail).toBe("Serviço cancelado");
    expect(pres.highlight.subdetail).toMatch(/Cancelado em/);
  });

  it("falls back to neighborhood/city when full address formatting is empty", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        address: {
          neighborhood: "Centro",
          cityName: "Florianópolis",
          streetSummary: "",
        },
      }),
    );

    expect(
      pres.secondaryInfo.some((item) => item.text?.includes("Serviço em Centro, Florianópolis")),
    ).toBe(true);
  });

  it("omits cancel secondary action when request is not open", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        requestStatus: "MATCHED",
      }),
    );

    expect(pres.primaryAction.intent).toBe("details");
    expect(pres.secondaryAction).toBeNull();
  });
});

describe("getClientServiceCardPresentation additional branches", () => {
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
      provider: { id: "p-1", displayName: "Maria", profileImagePath: null },
      chatId: null,
      updatedAt: null,
      ...overrides,
    };
  }

  it("uses singular labels for one received proposal", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        proposalCount: 1,
        unreadChatCount: 1,
        chatSummary: {
          id: null,
          isUnread: true,
          lastInteractionAt: null,
          lastMessagePreview: null,
          providerDisplayName: null,
        },
      }),
    );

    expect(pres.secondaryInfo).toContainEqual({ icon: "tag", text: "1 orçamento recebido" });
    expect(
      getClientServiceCardPresentation(baseModel({ proposalCount: 1 })).highlight.title,
    ).toBe("Orçamento recebido");
  });

  it("routes a single anonymous unread conversation to messages", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        unreadChatCount: 1,
        chatSummary: {
          id: null,
          isUnread: true,
          lastInteractionAt: null,
          lastMessagePreview: "Olá",
          providerDisplayName: null,
        },
      }),
    );

    expect(pres.primaryAction).toMatchObject({ label: "Ver mensagens", intent: "messages" });
  });

  it("omits location when address is missing", () => {
    const pres = getClientServiceCardPresentation(baseModel({ address: null }));

    expect(pres.secondaryInfo.some((item) => item.icon === "location")).toBe(false);
  });

  it("resolves provider names through contract and legacy fallbacks", () => {
    const fromContract = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        counterparty: null,
        contracted: contracted(),
      }),
    );
    const fromName = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        counterparty: null,
        counterpartyName: "Ana",
        contracted: contracted({ provider: null }),
      }),
    );

    expect(fromContract.secondaryInfo).toContainEqual({
      icon: "provider",
      text: "Profissional: Maria",
    });
    expect(fromName.secondaryInfo).toContainEqual({
      icon: "provider",
      text: "Profissional: Ana",
    });
  });

  it("offers cancellation while an open request waits for professionals", () => {
    const pres = getClientServiceCardPresentation(baseModel({ requestStatus: "OPEN" }));

    expect(pres.secondaryAction).toEqual({ label: "Cancelar pedido", intent: "cancel" });
  });

  it("keeps details secondary when unread messages have no proposals", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({ unreadChatCount: 1, proposalCount: 0 }),
    );

    expect(pres.secondaryAction).toEqual({ label: "Ver detalhes", intent: "details" });
  });

  it("prioritizes multiple unread messages over scheduled pending payment", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        unreadChatCount: 2,
        contracted: contracted({
          status: "PENDING_PAYMENT",
          paymentScheduleState: "SCHEDULED",
        }),
      }),
    );

    expect(pres.highlight.icon).toBe("new_message");
    expect(pres.highlight.detail).toBe("2 conversas com mensagens novas");
  });

  it("marks an in-progress service scheduled today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 8, 12, 0, 0));

    try {
      const pres = getClientServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          contracted: contracted({ scheduledStartDate: "2025-06-08" }),
        }),
      );

      expect(pres.isTodayService).toBe(true);
      expect(pres.highlight.icon).toBe("today");
      expect(pres.highlight.emphasis).toBe("urgent");
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for provider completion when the scheduled end date is past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 8, 12, 0, 0));

    try {
      const allDayPast = getClientServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          chatSummary: {
            id: "chat-1",
            isUnread: false,
            lastInteractionAt: "2025-06-01T00:00:00Z",
            lastMessagePreview: null,
            providerDisplayName: "Maria",
          },
          contracted: contracted({
            status: "CONFIRMED",
            scheduledStartDate: "2025-06-05",
            scheduledEndDate: null,
            scheduledShift: "full_day",
          }),
        }),
      );

      expect(allDayPast.highlight).toMatchObject({
        icon: "waiting",
        title: "Aguardando conclusão do prestador",
        detail:
          "Estamos aguardando a conclusão do serviço e as evidências do profissional",
        emphasis: "default",
      });
      expect(allDayPast.primaryAction).toMatchObject({
        label: "Ver detalhes",
        intent: "details",
      });

      const rangedStillActive = getClientServiceCardPresentation(
        baseModel({
          listPhase: "in_progress",
          statusTabId: "in_progress",
          contracted: contracted({
            status: "CONFIRMED",
            scheduledStartDate: "2025-06-07",
            scheduledEndDate: "2025-06-09",
          }),
        }),
      );
      expect(rangedStillActive.highlight?.icon).toBe("today");
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks the client to accept and rate after the provider marks executed", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contracted: contracted({
          status: "EXECUTED",
          scheduledStartDate: "2025-06-15",
        }),
      }),
    );

    expect(pres.highlight).toMatchObject({
      icon: "completed",
      title: "Aceite a conclusão e avalie o serviço",
      emphasis: "attention",
    });
    expect(pres.primaryAction).toMatchObject({
      label: "Avaliar serviço",
      intent: "evaluate_service",
    });
    expect(pres.secondaryAction).toMatchObject({
      label: "Ver detalhes",
      intent: "details",
    });
  });

  it("uses future timing without a contract or scheduled date", () => {
    const withoutContract = getClientServiceCardPresentation(
      baseModel({ listPhase: "in_progress", statusTabId: "in_progress", contracted: null }),
    );
    const withoutDate = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contracted: contracted({ scheduledStartDate: null }),
      }),
    );

    expect(withoutContract.highlight).toMatchObject({
      icon: "scheduled",
      title: "Serviço agendado",
    });
    expect(withoutDate.highlight.icon).toBe("scheduled");
  });

  it("omits provider information when in progress without a provider", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        counterparty: null,
        counterpartyName: null,
        contracted: contracted({ provider: null }),
      }),
    );

    expect(pres.secondaryInfo.some((item) => item.icon === "provider")).toBe(false);
  });

  it("falls back to contract update date for completion", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: null,
        contracted: contracted({ status: "COMPLETED", updatedAt: "2025-06-10T12:00:00Z" }),
      }),
    );

    expect(pres.secondaryInfo.some((item) => item.text.includes("Concluído em 10/06/2025"))).toBe(
      true,
    );
  });

  it("omits provider information from a completed service without one", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        counterparty: null,
        counterpartyName: null,
        contracted: contracted({ status: "COMPLETED", provider: null }),
      }),
    );

    expect(pres.secondaryInfo.some((item) => item.icon === "provider")).toBe(false);
  });

  it("distinguishes a cancelled request", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "CANCELLED",
      }),
    );

    expect(pres.highlight.detail).toBe("Pedido cancelado");
  });

  it("omits provider header and cancellation date when unavailable", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "MATCHED",
        cancelledAt: null,
        counterparty: null,
        counterpartyName: null,
        contracted: null,
      }),
    );

    expect(pres.showProviderHeader).toBe(false);
    expect(pres.highlight.subdetail).toBeUndefined();
  });

  it("disables chat actions when chat summary is missing", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        chatSummary: null,
      }),
    );

    expect(pres.primaryAction).toMatchObject({
      intent: "chat",
      disabled: true,
      disabledReason: "Conversa ainda não disponível para este pedido",
    });
  });

  it("shows high urgency", () => {
    expect(getClientServiceCardPresentation(baseModel({ urgency: "high" })).showUrgency).toBe(true);
  });

  it("uses the singular active conversation label", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({ activeChatCount: 1, chatSummary: null }),
    );

    expect(pres.secondaryInfo).toContainEqual({ icon: "chat", text: "1 conversa ativa" });
  });

  it("omits neighborhood label when address parts are blank", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        address: { neighborhood: "", cityName: "", streetSummary: undefined },
      }),
    );
    expect(pres.secondaryInfo.some((item) => item.icon === "location")).toBe(false);
  });

  it("omits chat secondary info for pending proposal without active chats", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        pendingProposalCount: 1,
        proposalCount: 1,
        activeChatCount: 0,
      }),
    );
    expect(pres.highlight.title).toBe("Novo orçamento para analisar");
    expect(pres.secondaryInfo.some((item) => item.icon === "chat")).toBe(false);
  });

  it("shows received proposals without active chat secondary info", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        proposalCount: 2,
        pendingProposalCount: 0,
        activeChatCount: 0,
      }),
    );
    expect(pres.highlight.title).toBe("Orçamentos recebidos");
    expect(pres.secondaryInfo.some((item) => item.icon === "chat")).toBe(false);
  });

  it("omits last-interaction detail when lastActivityAt is missing", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        activeChatCount: 2,
        proposalCount: 0,
        pendingProposalCount: 0,
        lastActivityAt: null,
      }),
    );
    expect(pres.highlight.title).toBe("Negociação em andamento");
    expect(pres.highlight.detail).toBeUndefined();
  });

  it("omits completion date when no closed timestamp exists", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: null,
        contracted: contracted({ status: "COMPLETED", updatedAt: null }),
      }),
    );
    expect(pres.secondaryInfo.some((item) => item.text.includes("Concluído em"))).toBe(false);
  });

  it("uses responder action when only chatSummary.isUnread is true", () => {
    const pres = getClientServiceCardPresentation(
      baseModel({
        listPhase: "in_progress",
        statusTabId: "in_progress",
        unreadChatCount: 0,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: "2025-06-01T00:00:00Z",
          lastMessagePreview: "Oi",
          providerDisplayName: "João",
        },
        contracted: contracted({ status: "CONFIRMED" }),
      }),
    );
    expect(pres.primaryAction).toMatchObject({ label: "Responder", intent: "chat" });
  });

  it("hides urgency flag for non-high urgency", () => {
    expect(getClientServiceCardPresentation(baseModel({ urgency: "medium" })).showUrgency).toBe(
      false,
    );
    expect(getClientServiceCardPresentation(baseModel({ urgency: null })).showUrgency).toBe(false);
  });
});
