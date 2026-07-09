import type { ServiceModel } from "@/features/view-services";

export interface ProviderServiceCardShowcaseVariant {
  id: string;
  label: string;
  description: string;
  group: "Negociação" | "Em andamento" | "Concluídos" | "Cancelados";
  model: ServiceModel;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
      street: "Rua Felipe Schmidt",
      number: "120",
      streetSummary: "Rua Felipe Schmidt, 120",
    },
    service: { title: "Eletricista", slug: "eletricista" },
    photoPaths: [],
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
    unreadChatCount: 0,
    counterpartyName: "Maria Silva",
    counterparty: {
      id: "client-maria",
      displayName: "Maria Silva",
      profileImagePath: null,
    },
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

const defaultProposal = {
  id: "proposal-1",
  status: "PENDING" as const,
  finalAmount: 425,
  updatedAt: "2025-03-02T00:00:00Z",
  expiredAt: null,
  submittedAt: "2025-03-02T00:00:00Z",
  revisionReason: null,
  revisionNotes: null,
  clientRejectionResponse: null,
};

export function buildProviderServiceCardShowcaseVariants(
  now = new Date(),
): ProviderServiceCardShowcaseVariant[] {
  const today = toDateOnly(now);
  const tomorrow = toDateOnly(addDays(now, 1));
  const inFifteenDays = toDateOnly(addDays(now, 15));
  const inTwoDaysIso = addDays(now, 2).toISOString();
  const twoDaysAgoIso = addDays(now, -2).toISOString();

  return [
    {
      id: "negotiation-unread",
      label: "Nova mensagem recebida",
      description: "Mensagem inbound não lida do cliente, com preview no destaque.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-unread",
        urgency: "high",
        myProposal: { ...defaultProposal, status: "PENDING" },
        hasPendingProposal: true,
        proposalCount: 1,
        chatSummary: {
          id: "chat-unread",
          isUnread: true,
          lastInteractionAt: now.toISOString(),
          lastMessagePreview: "Você consegue realizar ainda essa semana?",
        },
      }),
    },
    {
      id: "negotiation-revision",
      label: "Cliente solicitou revisão",
      description: "Proposta com status REVISION_REQUESTED e notas do cliente.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-revision",
        myProposal: {
          ...defaultProposal,
          status: "REVISION_REQUESTED",
          revisionReason: "PRICE_TOO_HIGH",
          revisionNotes: "Consegue reduzir um pouco o valor do material?",
        },
        chatSummary: {
          id: "chat-revision",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "negotiation-pending",
      label: "Aguardando decisão do cliente",
      description: "Proposta enviada aguardando aceite ou recusa.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-pending",
        hasPendingProposal: true,
        proposalCount: 1,
        myProposal: defaultProposal,
        chatSummary: {
          id: "chat-pending",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "negotiation-pending-expiring",
      label: "Proposta expirando em breve",
      description: "Proposta pendente com prazo de resposta próximo do fim.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-pending-expiring",
        hasPendingProposal: true,
        proposalCount: 1,
        myProposal: {
          ...defaultProposal,
          expiredAt: inTwoDaysIso,
        },
        chatSummary: {
          id: "chat-pending-expiring",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "negotiation-active",
      label: "Negociação em andamento",
      description: "Chat ativo sem mensagem não lida e sem proposta pendente.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-active",
        myProposal: {
          ...defaultProposal,
          status: "REJECTED",
          clientRejectionResponse: null,
        },
        chatSummary: {
          id: "chat-active",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: "Ok, combinado então.",
        },
      }),
    },
    {
      id: "negotiation-start-chat",
      label: "Inicie a conversa com o cliente",
      description: "Sem chat aberto ainda; CTA primário desabilitado.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-start-chat",
        chatSummary: null,
      }),
    },
    {
      id: "negotiation-no-proposal",
      label: "Negociação sem proposta enviada",
      description: "Chat ativo, ainda sem orçamento formal do prestador.",
      group: "Negociação",
      model: baseModel({
        id: "showcase-no-proposal",
        chatSummary: {
          id: "chat-no-proposal",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: "Preciso de um orçamento.",
        },
      }),
    },
    {
      id: "in-progress-scheduled",
      label: "Serviço agendado (amanhã)",
      description: "Contrato confirmado com execução no dia seguinte.",
      group: "Em andamento",
      model: baseModel({
        id: "showcase-scheduled",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-scheduled",
        myProposal: { ...defaultProposal, status: "ACCEPTED" },
        contracted: {
          id: "cs-scheduled",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 4,
          scheduledStartDate: tomorrow,
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          chatId: null,
          updatedAt: now.toISOString(),
        },
        chatSummary: {
          id: "chat-scheduled",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "in-progress-scheduled-future",
      label: "Serviço agendado (daqui a 15 dias)",
      description: "Contrato confirmado com data de execução distante.",
      group: "Em andamento",
      model: baseModel({
        id: "showcase-scheduled-future",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-scheduled-future",
        myProposal: { ...defaultProposal, status: "ACCEPTED", finalAmount: 680 },
        contracted: {
          id: "cs-scheduled-future",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 6,
          scheduledStartDate: inFifteenDays,
          scheduledEndDate: null,
          scheduledShift: "full_day",
          provider: null,
          chatId: null,
          updatedAt: now.toISOString(),
        },
        chatSummary: {
          id: "chat-scheduled-future",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "in-progress-today",
      label: "Serviço hoje",
      description: "Execução agendada para hoje com destaque urgente.",
      group: "Em andamento",
      model: baseModel({
        id: "showcase-today",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-today",
        myProposal: { ...defaultProposal, status: "ACCEPTED", finalAmount: 380 },
        contracted: {
          id: "cs-today",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 3,
          scheduledStartDate: today,
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: null,
          chatId: null,
          updatedAt: now.toISOString(),
        },
        chatSummary: {
          id: "chat-today",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "in-progress-unread",
      label: "Serviço em andamento — nova mensagem",
      description:
        "Mensagem não lida do cliente; destaque de chat com agendamento no painel secundário.",
      group: "Em andamento",
      model: baseModel({
        id: "showcase-in-progress-unread",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-unread",
        myProposal: { ...defaultProposal, status: "ACCEPTED", finalAmount: 520 },
        contracted: {
          id: "cs-unread",
          status: "CONFIRMED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 4,
          scheduledStartDate: today,
          scheduledEndDate: null,
          scheduledShift: "afternoon",
          provider: null,
          chatId: null,
          updatedAt: now.toISOString(),
        },
        chatSummary: {
          id: "chat-in-progress-unread",
          isUnread: true,
          lastInteractionAt: now.toISOString(),
          lastMessagePreview: "Posso receber você às 15h ou prefere mais cedo?",
        },
      }),
    },
    {
      id: "in-progress-payment",
      label: "Aguardando pagamento do cliente",
      description:
        "Contrato em PENDING_PAYMENT: título com “do cliente”, data do serviço e ícone de cartão.",
      group: "Em andamento",
      model: baseModel({
        id: "showcase-payment",
        listPhase: "in_progress",
        statusTabId: "in_progress",
        contractedServiceId: "cs-payment",
        myProposal: { ...defaultProposal, status: "ACCEPTED" },
        contracted: {
          id: "cs-payment",
          status: "PENDING_PAYMENT",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 5,
          scheduledStartDate: toDateOnly(addDays(now, 7)),
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          chatId: null,
          updatedAt: now.toISOString(),
        },
        chatSummary: {
          id: "chat-payment",
          isUnread: false,
          lastInteractionAt: twoDaysAgoIso,
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "completed",
      label: "Serviço concluído",
      description: "Fase finalizada com valor, data e avaliação mock.",
      group: "Concluídos",
      model: baseModel({
        id: "showcase-completed",
        listPhase: "completed",
        statusTabId: "completed",
        completedAt: addDays(now, -3).toISOString(),
        myProposal: { ...defaultProposal, status: "ACCEPTED" },
        contracted: {
          id: "cs-completed",
          status: "COMPLETED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 4,
          scheduledStartDate: toDateOnly(addDays(now, -5)),
          scheduledEndDate: null,
          scheduledShift: "full_day",
          provider: null,
          chatId: null,
          updatedAt: addDays(now, -3).toISOString(),
        },
        chatSummary: {
          id: "chat-completed",
          isUnread: false,
          lastInteractionAt: addDays(now, -3).toISOString(),
          lastMessagePreview: null,
        },
      }),
    },
    {
      id: "cancelled-request",
      label: "Pedido cancelado pelo cliente",
      description: "Service request cancelado antes da execução.",
      group: "Cancelados",
      model: baseModel({
        id: "showcase-cancelled-request",
        listPhase: "cancelled",
        statusTabId: "cancelled",
        requestStatus: "CANCELLED",
        cancelledAt: addDays(now, -1).toISOString(),
      }),
    },
    {
      id: "cancelled-proposal-rejected",
      label: "Proposta recusada pelo cliente",
      description: "Cancelado com motivo informado na recusa da proposta.",
      group: "Cancelados",
      model: baseModel({
        id: "showcase-cancelled-rejected",
        listPhase: "cancelled",
        statusTabId: "cancelled",
        cancelledAt: addDays(now, -2).toISOString(),
        myProposal: {
          ...defaultProposal,
          status: "REJECTED",
          clientRejectionResponse: "Optei por outro profissional com prazo menor.",
        },
      }),
    },
    {
      id: "cancelled-contract",
      label: "Serviço contratado cancelado",
      description: "Contrato cancelado após aceite da proposta.",
      group: "Cancelados",
      model: baseModel({
        id: "showcase-cancelled-contract",
        listPhase: "cancelled",
        statusTabId: "cancelled",
        cancelledAt: addDays(now, -4).toISOString(),
        myProposal: { ...defaultProposal, status: "ACCEPTED" },
        contracted: {
          id: "cs-cancelled",
          status: "CANCELLED",
          agreedSlot: null,
          durationUnit: "hours",
          durationValue: 2,
          scheduledStartDate: toDateOnly(addDays(now, -6)),
          scheduledEndDate: null,
          scheduledShift: "morning",
          provider: null,
          chatId: null,
          updatedAt: addDays(now, -4).toISOString(),
        },
      }),
    },
  ];
}
