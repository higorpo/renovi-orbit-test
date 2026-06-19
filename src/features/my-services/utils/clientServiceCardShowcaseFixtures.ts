import type { ServiceModel } from "@/features/view-services";

export interface ClientServiceCardShowcaseVariant {
  id: string;
  label: string;
  description: string;
  group: "Negociação" | "Em andamento" | "Concluídos" | "Cancelados";
  model: ServiceModel;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function baseModel(overrides: Partial<ServiceModel> & { id: string }): ServiceModel {
  const { id, ...rest } = overrides;

  return {
    id,
    title: "Troca de disjuntor com quedas frequentes de energia",
    description: "Descrição do serviço para preview do card.",
    descriptionPreview: "Descrição do serviço para preview do card.",
    formData: null,
    formSchema: null,
    listPhase: "negotiation",
    statusTabId: "negotiation",
    contractedServiceId: null,
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2025-03-02T00:00:00Z",
    requestStatus: "OPEN",
    cancelledAt: null,
    completedAt: null,
    address: {
      neighborhood: "Centro",
      cityName: "Florianópolis",
    },
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
    lastActivityAt: "2025-03-02T12:00:00Z",
    myProposal: null,
    chatSummary: null,
    ...rest,
  };
}

export function buildClientServiceCardShowcaseVariants(
  now = new Date(),
): ClientServiceCardShowcaseVariant[] {
  const today = toDateOnly(now);

  return [
    {
      id: "negotiation-unread-multi",
      label: "Mensagens novas (várias conversas)",
      description: "2 conversas com mensagens não lidas; preview da mais recente.",
      group: "Negociação",
      model: baseModel({
        id: "client-unread-multi",
        proposalCount: 3,
        hasPendingProposal: true,
        pendingProposalCount: 2,
        activeChatCount: 3,
        unreadChatCount: 2,
        chatSummary: {
          id: "chat-1",
          isUnread: true,
          lastInteractionAt: now.toISOString(),
          lastMessagePreview: "Posso ir amanhã de manhã para avaliar.",
          providerDisplayName: "João Eletricista",
        },
      }),
    },
    {
      id: "negotiation-pending-multi",
      label: "Vários orçamentos pendentes",
      description: "3 orçamentos recebidos, 2 aguardando decisão.",
      group: "Negociação",
      model: baseModel({
        id: "client-pending-multi",
        proposalCount: 3,
        hasPendingProposal: true,
        pendingProposalCount: 2,
        activeChatCount: 2,
        unreadChatCount: 0,
      }),
    },
    {
      id: "negotiation-proposals-only",
      label: "Orçamentos sem mensagens novas",
      description: "Compare orçamentos de múltiplos prestadores.",
      group: "Negociação",
      model: baseModel({
        id: "client-proposals",
        proposalCount: 2,
        hasPendingProposal: false,
        pendingProposalCount: 0,
        activeChatCount: 1,
        unreadChatCount: 0,
      }),
    },
    {
      id: "negotiation-chats-only",
      label: "Conversas ativas, sem orçamento",
      description: "Negociação com 2 prestadores, ainda sem proposta formal.",
      group: "Negociação",
      model: baseModel({
        id: "client-chats",
        activeChatCount: 2,
        unreadChatCount: 0,
        lastActivityAt: addDays(now, -1).toISOString(),
      }),
    },
    {
      id: "negotiation-waiting",
      label: "Aguardando profissionais",
      description: "Pedido publicado sem conversas nem orçamentos.",
      group: "Negociação",
      model: baseModel({ id: "client-waiting" }),
    },
    {
      id: "in-progress-today",
      label: "Serviço hoje",
      description: "Prestador contratado; serviço agendado para hoje.",
      group: "Em andamento",
      model: baseModel({
        id: "client-in-progress-today",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        counterpartyName: "Maria Instalações",
        counterparty: {
          id: "prov-maria",
          displayName: "Maria Instalações",
          profileImagePath: null,
        },
        contracted: {
          id: "cs-1",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 4,
          scheduledStartDate: today,
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: { id: "prov-maria", displayName: "Maria Instalações", profileImagePath: null },
          chatId: null,
          updatedAt: now.toISOString(),
        },
      }),
    },
    {
      id: "completed",
      label: "Serviço concluído",
      description: "Exibe prestador contratado e data de conclusão.",
      group: "Concluídos",
      model: baseModel({
        id: "client-completed",
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: addDays(now, -5).toISOString(),
        counterpartyName: "Carlos Reparos",
        counterparty: {
          id: "prov-carlos",
          displayName: "Carlos Reparos",
          profileImagePath: null,
        },
        contracted: {
          id: "cs-2",
          status: "COMPLETED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 3,
          scheduledStartDate: addDays(now, -6).toISOString(),
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: { id: "prov-carlos", displayName: "Carlos Reparos", profileImagePath: null },
          chatId: null,
          updatedAt: addDays(now, -5).toISOString(),
        },
      }),
    },
    {
      id: "cancelled",
      label: "Pedido cancelado",
      description: "Cliente cancelou o pedido em negociação.",
      group: "Cancelados",
      model: baseModel({
        id: "client-cancelled",
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "CANCELLED",
        cancelledAt: addDays(now, -2).toISOString(),
      }),
    },
  ];
}
