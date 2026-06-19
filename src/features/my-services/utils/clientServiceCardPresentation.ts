import {
  formatLocationDisplay,
  formatServiceDate,
  getScheduleHighlightContent,
  getScheduledTiming,
  getServiceRequestBudgetActionState,
  getStatusBadgeVariant,
  getStatusLabel,
  type ServiceModel,
  type StatusBadgeVariant,
} from "@/features/view-services";
import { formatRelativeDate } from "@/lib/formatRelativeDate";

export type ClientCardActionIntent = "details" | "budgets" | "cancel" | "messages" | "chat";

export type ClientCardHighlightEmphasis =
  | "default"
  | "attention"
  | "urgent"
  | "cancelled";

export type ClientCardHighlightIcon =
  | "new_message"
  | "proposals"
  | "waiting"
  | "conversation"
  | "scheduled"
  | "today"
  | "completed"
  | "cancelled";

export type ClientCardInfoIcon =
  | "location"
  | "amount"
  | "date"
  | "provider"
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

export interface ClientCardAction {
  label: string;
  intent: ClientCardActionIntent;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ClientServiceCardPresentation {
  phaseLabel: string;
  phaseBadgeVariant: StatusBadgeVariant;
  highlight: ClientCardHighlight;
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
  return formatServiceDate(iso);
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

function buildInProgressPresentation(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"> {
  const secondaryInfo: ClientCardSecondaryInfo[] = [];
  const contracted = model.contracted;
  const professional = providerName(model);
  const scheduleHighlight = contracted ? getScheduleHighlightContent(contracted) : null;
  const timing = contracted?.scheduledStartDate
    ? getScheduledTiming(contracted.scheduledStartDate)
    : "future";
  const paymentPending = contracted?.status === "PENDING_PAYMENT";
  const unreadCount = model.unreadChatCount;
  const isTodayService = timing === "today";

  pushSecondaryInfo(secondaryInfo, {
    icon: "location",
    text: serviceLocationLabel(model),
  });
  if (professional) {
    pushSecondaryInfo(secondaryInfo, { icon: "provider", text: `Profissional: ${professional}` });
  }

  if (unreadCount > 0) {
    pushSecondaryInfo(secondaryInfo, {
      icon: "date",
      text: scheduleHighlight?.title,
    });

    return {
      showProviderHeader: true,
      isTodayService,
      highlight: buildUnreadHighlight(model),
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
      detail: paymentPending ? "Aguardando pagamento" : undefined,
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
    highlight: {
      icon: "completed",
      title: "Serviço concluído",
      emphasis: "default",
    },
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

function chatDisabled(model: ServiceModel): boolean {
  return !model.chatSummary?.id;
}

function chatAction(model: ServiceModel, label = "Ver conversa com prestador"): ClientCardAction {
  const disabled = chatDisabled(model);
  return {
    label,
    intent: "chat",
    disabled,
    disabledReason: disabled ? "Conversa ainda não disponível para este pedido" : undefined,
  };
}

function unreadMessagesAction(model: ServiceModel): ClientCardAction {
  const latestChat = model.chatSummary;
  const providerLabel = latestChat?.providerDisplayName?.trim();
  const singleUnreadChat =
    model.unreadChatCount === 1 && Boolean(providerLabel) && Boolean(latestChat?.id);

  if (singleUnreadChat) {
    return { label: "Ver mensagem", intent: "chat" };
  }

  return { label: "Ver mensagens", intent: "messages" };
}

function budgetsAction(model: ServiceModel): ClientCardAction {
  const action = getServiceRequestBudgetActionState(model);

  return {
    label: action.label,
    intent: "budgets",
    disabled: action.disabled,
    disabledReason: action.disabledReason,
  };
}

function buildNegotiationActions(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "primaryAction" | "secondaryAction"> {
  const unreadCount = model.unreadChatCount;
  const pendingCount = model.pendingProposalCount;
  const proposalCount = model.proposalCount;
  const canCancel = model.requestStatus === "OPEN";

  if (unreadCount > 0) {
    return {
      primaryAction: unreadMessagesAction(model),
      secondaryAction:
        proposalCount > 0 ? budgetsAction(model) : { label: "Ver detalhes", intent: "details" },
    };
  }

  if (pendingCount > 0 || proposalCount > 0) {
    return {
      primaryAction: budgetsAction(model),
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  if (canCancel) {
    return {
      primaryAction: { label: "Ver detalhes", intent: "details" },
      secondaryAction: { label: "Cancelar pedido", intent: "cancel" },
    };
  }

  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildInProgressActions(
  model: ServiceModel,
): Pick<ClientServiceCardPresentation, "primaryAction" | "secondaryAction"> {
  if (model.chatSummary?.isUnread || model.unreadChatCount > 0) {
    return {
      primaryAction: chatAction(model, "Responder"),
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  return {
    primaryAction: chatAction(model),
    secondaryAction: { label: "Ver detalhes", intent: "details" },
  };
}

function buildCompletedActions(): Pick<
  ClientServiceCardPresentation,
  "primaryAction" | "secondaryAction"
> {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildCancelledActions(): Pick<
  ClientServiceCardPresentation,
  "primaryAction" | "secondaryAction"
> {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

export function getClientServiceCardPresentation(
  model: ServiceModel,
): ClientServiceCardPresentation {
  const phaseLabel = getStatusLabel(model.listPhase, model.hasPendingProposal);
  const phaseBadgeVariant = getStatusBadgeVariant(model.listPhase, model.proposalCount);

  let content: Pick<
    ClientServiceCardPresentation,
    "highlight" | "secondaryInfo" | "isTodayService" | "showProviderHeader"
  >;
  let actions: Pick<ClientServiceCardPresentation, "primaryAction" | "secondaryAction">;

  switch (model.listPhase) {
    case "in_progress":
      content = buildInProgressPresentation(model);
      actions = buildInProgressActions(model);
      break;
    case "completed":
      content = buildCompletedPresentation(model);
      actions = buildCompletedActions();
      break;
    case "cancelled":
      content = buildCancelledPresentation(model);
      actions = buildCancelledActions();
      break;
    default:
      content = { ...buildNegotiationPresentation(model), isTodayService: false };
      actions = buildNegotiationActions(model);
  }

  return {
    phaseLabel,
    phaseBadgeVariant,
    showUrgency: model.urgency === "high",
    ...content,
    ...actions,
  };
}
