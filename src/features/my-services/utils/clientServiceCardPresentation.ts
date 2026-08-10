import {
  formatLocationDisplay,
  getPendingPaymentHighlightContent,
  getScheduleHighlightContent,
  getScheduledTiming,
  getStatusBadgeVariant,
  getStatusLabel,
  resolveClientCardActions,
  type ClientServiceActionIntent,
  type ClientServiceCardAction,
  type ContractedServiceStatus,
  type ServiceModel,
  type StatusBadgeVariant,
} from "@/features/view-services";
import { formatDatePtBr } from "@/lib/utils/formatDate";
import { formatRelativeDate } from "@/lib/formatRelativeDate";

export type ClientCardActionIntent = ClientServiceActionIntent;

export type ClientCardHighlightEmphasis =
  | "default"
  | "attention"
  | "urgent"
  | "error"
  | "cancelled";

export type ClientCardHighlightIcon =
  | "new_message"
  | "proposals"
  | "waiting"
  | "conversation"
  | "scheduled"
  | "today"
  | "payment_pending"
  | "completed"
  | "cancelled";

export type ClientCardInfoIcon =
  | "location"
  | "amount"
  | "date"
  | "provider"
  | "info"
  | "tag"
  | "chat";

export interface ClientCardHighlight {
  icon: ClientCardHighlightIcon;
  title: string;
  detail?: string;
  subdetail?: string;
  messagePreview?: string;
  emphasis: ClientCardHighlightEmphasis;
}

export interface ClientCardSecondaryInfo {
  icon?: ClientCardInfoIcon;
  text: string;
}

export type ClientCardAction = ClientServiceCardAction;

export interface ClientServiceCardPresentation {
  phaseLabel: string;
  phaseBadgeVariant: StatusBadgeVariant;
  highlight: ClientCardHighlight | null;
  secondaryInfo: ClientCardSecondaryInfo[];
  showUrgency: boolean;
  isTodayService: boolean;
  showProviderHeader: boolean;
  primaryAction: ClientCardAction;
  secondaryAction: ClientCardAction | null;
}

function proposalCountLabel(count: number): string {
  if (count === 1) return "1 orçamento recebido";
  return `${count} orçamentos recebidos`;
}

function pendingProposalLabel(count: number): string {
  if (count === 1) return "1 orçamento aguardando sua resposta";
  return `${count} orçamentos aguardando sua resposta`;
}

function activeChatLabel(count: number): string {
  if (count === 1) return "1 conversa ativa";
  return `${count} conversas ativas`;
}

function unreadChatLabel(count: number): string {
  if (count === 1) return "1 conversa com mensagem nova";
  return `${count} conversas com mensagens novas`;
}

function neighborhoodCity(model: ServiceModel): string | null {
  const address = model.address;
  if (!address) return null;
  const value = [address.neighborhood, address.cityName].filter(Boolean).join(", ");
  return value ? `Serviço em ${value}` : null;
}

function fullAddress(model: ServiceModel): string | null {
  const value = formatLocationDisplay(model.address);
  return value ? `Serviço em ${value}` : null;
}

function serviceLocationLabel(model: ServiceModel): string | null {
  return fullAddress(model) ?? neighborhoodCity(model);
}

function formatClosedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatDatePtBr(iso);
}

function providerName(model: ServiceModel): string | null {
  return (
    model.counterparty?.displayName?.trim() ||
    model.contracted?.provider?.displayName?.trim() ||
    model.counterpartyName?.trim() ||
    null
  );
}

function pushSecondaryInfo(
  items: ClientCardSecondaryInfo[],
  entry: { icon?: ClientCardInfoIcon; text: string | null | undefined },
): void {
  if (!entry.text?.trim()) return;
  items.push({ icon: entry.icon, text: entry.text.trim() });
}

function buildUnreadHighlight(model: ServiceModel): ClientCardHighlight {
  const latestChat = model.chatSummary;
  const unreadCount = model.unreadChatCount;
  const providerLabel = latestChat?.providerDisplayName?.trim();
  const title =
    unreadCount === 1 && providerLabel
      ? `Nova mensagem de ${providerLabel}`
      : "Mensagens novas de prestadores";

  return {
    icon: "new_message",
    title,
    messagePreview: latestChat?.lastMessagePreview ?? undefined,
    detail: unreadCount > 1 ? unreadChatLabel(unreadCount) : undefined,
    emphasis: "attention",
  };
}

function buildNegotiationPresentation(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "highlight" | "secondaryInfo" | "showProviderHeader"> {
  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  const location = serviceLocationLabel(model);
  const unreadCount = model.unreadChatCount;
  const pendingCount = model.pendingProposalCount;
  const proposalCount = model.proposalCount;
  const chatCount = model.activeChatCount;
  const lastActivity = model.lastActivityAt;

  if (unreadCount > 0) {
    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });
    if (proposalCount > 0) {
      pushSecondaryInfo(secondaryInfo, { icon: "tag", text: proposalCountLabel(proposalCount) });
    }
    if (chatCount > 1) {
      pushSecondaryInfo(secondaryInfo, { icon: "chat", text: activeChatLabel(chatCount) });
    }

    return {
      showProviderHeader: false,
      highlight: buildUnreadHighlight(model),
      secondaryInfo,
    };
  }

  if (pendingCount > 0) {
    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });
    pushSecondaryInfo(secondaryInfo, { icon: "tag", text: proposalCountLabel(proposalCount) });
    if (chatCount > 0) {
      pushSecondaryInfo(secondaryInfo, { icon: "chat", text: activeChatLabel(chatCount) });
    }

    return {
      showProviderHeader: false,
      highlight: {
        icon: "proposals",
        title: pendingCount === 1 ? "Novo orçamento para analisar" : "Novos orçamentos para analisar",
        detail: pendingProposalLabel(pendingCount),
        emphasis: "attention",
      },
      secondaryInfo,
    };
  }

  if (proposalCount > 0) {
    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });
    if (chatCount > 0) {
      pushSecondaryInfo(secondaryInfo, { icon: "chat", text: activeChatLabel(chatCount) });
    }

    return {
      showProviderHeader: false,
      highlight: {
        icon: "proposals",
        title: proposalCount === 1 ? "Orçamento recebido" : "Orçamentos recebidos",
        detail: "Compare valores e prazos antes de decidir",
        emphasis: "default",
      },
      secondaryInfo,
    };
  }

  if (chatCount > 0) {
    const relative = lastActivity ? formatRelativeDate(lastActivity) : null;

    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });
    pushSecondaryInfo(secondaryInfo, { icon: "chat", text: activeChatLabel(chatCount) });

    return {
      showProviderHeader: false,
      highlight: {
        icon: "conversation",
        title: "Negociação em andamento",
        detail: relative ? `Última interação ${relative.toLowerCase()}` : undefined,
        emphasis: "default",
      },
      secondaryInfo,
    };
  }

  pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });

  return {
    showProviderHeader: false,
    highlight: {
      icon: "waiting",
      title: "Aguardando profissionais",
      detail: "Você será notificado quando receber orçamentos ou mensagens",
      emphasis: "default",
    },
    secondaryInfo,
  };
}

function buildCompletionFollowUpHighlight(
  status: ContractedServiceStatus | undefined,
  timing: ReturnType<typeof getScheduledTiming>,
): ClientCardHighlight | null {
  // Provider already submitted evidence — client must accept + rate.
  if (status === "EXECUTED") {
    return {
      icon: "completed",
      title: "Aceite a conclusão e avalie o serviço",
      detail: "O prestador enviou as evidências — confirme a conclusão e deixe sua avaliação",
      emphasis: "attention",
    };
  }

  // Past scheduled end (end defaults to start for all-day) → wait for provider completion.
  if (status === "CONFIRMED" && timing === "past") {
    return {
      icon: "waiting",
      title: "Aguardando conclusão do prestador",
      detail: "Estamos aguardando a conclusão do serviço e as evidências do profissional",
      emphasis: "default",
    };
  }

  return null;
}

function buildInProgressPresentation(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"> {
  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  const contracted = model.contracted;
  const professional = providerName(model);
  const scheduleHighlight = contracted ? getScheduleHighlightContent(contracted) : null;
  const timing = contracted?.scheduledStartDate
    ? getScheduledTiming(contracted.scheduledStartDate, contracted.scheduledEndDate)
    : "future";
  const paymentPending = contracted?.status === "PENDING_PAYMENT";
  const unreadCount = model.unreadChatCount;
  const isTodayService = timing === "today";
  const completionHighlight = buildCompletionFollowUpHighlight(contracted?.status, timing);

  pushSecondaryInfo(secondaryInfo, {
    icon: "location",
    text: serviceLocationLabel(model),
  });
  if (professional) {
    pushSecondaryInfo(secondaryInfo, { icon: "provider", text: `Profissional: ${professional}` });
  }

  if (paymentPending && contracted) {
    const pendingPayment = getPendingPaymentHighlightContent(contracted, "client");
    const isPermanentFailure = contracted.paymentScheduleState === "FAILED_PERMANENT";

    // Permanent payment failure outranks unread chat — client must fix payment first.
    if (isPermanentFailure || unreadCount === 0) {
      return {
        showProviderHeader: true,
        isTodayService,
        highlight: {
          icon: "payment_pending",
          title: pendingPayment.title,
          detail: pendingPayment.detail,
          emphasis: pendingPayment.emphasis,
        },
        secondaryInfo,
      };
    }
  }

  // Provider already marked executed — evaluate outranks unread chat (same as permanent payment failure).
  if (completionHighlight && contracted?.status === "EXECUTED") {
    return {
      showProviderHeader: true,
      isTodayService,
      highlight: completionHighlight,
      secondaryInfo,
    };
  }

  if (unreadCount > 0) {
    pushSecondaryInfo(secondaryInfo, {
      icon: completionHighlight?.title ? "info" : "date",
      text: completionHighlight?.title ?? scheduleHighlight?.title,
    });

    return {
      showProviderHeader: true,
      isTodayService,
      highlight: buildUnreadHighlight(model),
      secondaryInfo,
    };
  }

  if (completionHighlight) {
    return {
      showProviderHeader: true,
      isTodayService,
      highlight: completionHighlight,
      secondaryInfo,
    };
  }

  const highlightIcon: ClientCardHighlightIcon = timing === "today" ? "today" : "scheduled";

  return {
    showProviderHeader: true,
    isTodayService,
    highlight: {
      icon: highlightIcon,
      title: scheduleHighlight?.title ?? "Serviço agendado",
      emphasis: timing === "today" ? "urgent" : "default",
    },
    secondaryInfo,
  };
}

function buildCompletedPresentation(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"> {
  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  const professional = providerName(model);
  const executedAt =
    formatClosedDate(model.completedAt) ?? formatClosedDate(model.contracted?.updatedAt);

  pushSecondaryInfo(secondaryInfo, { icon: "location", text: serviceLocationLabel(model) });
  if (professional) {
    pushSecondaryInfo(secondaryInfo, { icon: "provider", text: `Profissional: ${professional}` });
  }
  pushSecondaryInfo(secondaryInfo, { icon: "date", text: executedAt ? `Concluído em ${executedAt}` : null });

  return {
    showProviderHeader: true,
    isTodayService: false,
    highlight: null,
    secondaryInfo,
  };
}

function buildCancelledPresentation(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"> {
  const cancelledAt =
    formatClosedDate(model.cancelledAt) ?? formatClosedDate(model.contracted?.updatedAt);
  const reason =
    model.requestStatus === "CANCELLED"
      ? "Pedido cancelado"
      : model.contracted?.status === "CANCELLED"
        ? "Serviço cancelado"
        : null;

  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  pushSecondaryInfo(secondaryInfo, { icon: "location", text: serviceLocationLabel(model) });

  return {
    showProviderHeader: Boolean(providerName(model)),
    isTodayService: false,
    highlight: {
      icon: "cancelled",
      title: "Serviço cancelado",
      detail: reason ?? undefined,
      subdetail: cancelledAt ? `Cancelado em ${cancelledAt}` : undefined,
      emphasis: "cancelled",
    },
    secondaryInfo,
  };
}

function buildDisputePresentation(
  model: ServiceModel,
): Pick<
  ClientServiceCardPresentation,
  "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"
> {
  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  const professional = providerName(model);

  pushSecondaryInfo(secondaryInfo, {
    icon: "location",
    text: serviceLocationLabel(model),
  });
  if (professional) {
    pushSecondaryInfo(secondaryInfo, {
      icon: "provider",
      text: `Profissional: ${professional}`,
    });
  }

  return {
    showProviderHeader: true,
    isTodayService: false,
    highlight: {
      icon: "waiting",
      title: "Serviço em disputa",
      detail:
        "A plataforma está analisando o caso, nossa equipe irá entrar em contato caso necessário.",
      emphasis: "attention",
    },
    secondaryInfo,
  };
}

export function getClientServiceCardPresentation(
  model: ServiceModel,
): ClientServiceCardPresentation {
  const phaseLabel = getStatusLabel(model.listPhase, model.hasPendingProposal);
  const phaseBadgeVariant = getStatusBadgeVariant(model.listPhase, model.proposalCount);
  const actions = resolveClientCardActions(model);

  let content: Pick<
    ClientServiceCardPresentation,
    "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"
  >;

  switch (model.listPhase) {
    case "in_progress":
      content = buildInProgressPresentation(model);
      break;
    case "completed":
      content = buildCompletedPresentation(model);
      break;
    case "cancelled":
      content = buildCancelledPresentation(model);
      break;
    case "dispute":
      content = buildDisputePresentation(model);
      break;
    default:
      content = { ...buildNegotiationPresentation(model), isTodayService: false };
  }

  return {
    phaseLabel,
    phaseBadgeVariant,
    showUrgency: model.urgency === "high",
    ...content,
    ...actions,
  };
}
