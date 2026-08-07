import { getProposalRevisionReasonLabel } from "@/features/negotiation-proposals";
import {
  formatLocationDisplay,
  getScheduleHighlightContent,
  getScheduledTiming,
  getStatusBadgeVariant,
  getStatusLabel,
  getServiceCoordinates,
  type ContractedServiceStatus,
  type ServiceModel,
  type StatusBadgeVariant,
} from "@/features/view-services";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDatePtBr } from "@/lib/utils/formatDate";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { getPendingPaymentHighlightContent } from "./pendingPaymentHighlight";
import { isProposalExpiringSoon } from "./providerProposalStatus";

export type ProviderCardActionIntent =
  | "chat"
  | "details"
  | "open_map"
  | "revise_proposal"
  | "view_proposal"
  | "mark_executed";

export type ProviderCardHighlightEmphasis =
  | "default"
  | "attention"
  | "urgent"
  | "cancelled";

export type ProviderCardHighlightIcon =
  | "new_message"
  | "revision"
  | "waiting"
  | "conversation"
  | "scheduled"
  | "today"
  | "payment_pending"
  | "completed"
  | "cancelled";

export type ProviderCardInfoIcon =
  | "location"
  | "amount"
  | "date"
  | "info"
  | "rating"
  | "quote"
  | "tag";

export interface ProviderCardHighlight {
  icon: ProviderCardHighlightIcon;
  title: string;
  detail?: string;
  subdetail?: string;
  messagePreview?: string;
  emphasis: ProviderCardHighlightEmphasis;
}

export interface ProviderCardSecondaryInfo {
  icon?: ProviderCardInfoIcon;
  text: string;
}

export interface ProviderCardAction {
  label: string;
  intent: ProviderCardActionIntent | "details" | "chat";
  disabled?: boolean;
  disabledReason?: string;
}

export interface ProviderServiceCardPresentation {
  phaseLabel: string;
  phaseBadgeVariant: StatusBadgeVariant;
  highlight: ProviderCardHighlight | null;
  secondaryInfo: ProviderCardSecondaryInfo[];
  showUrgency: boolean;
  isTodayService: boolean;
  primaryAction: ProviderCardAction;
  secondaryAction: ProviderCardAction | null;
}

function proposalAmount(model: ServiceModel): string | null {
  if (model.myProposal?.finalAmount == null) return null;
  return `Você recebe ${formatCurrency(model.myProposal.finalAmount)}`;
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

function formatClosedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatDatePtBr(iso);
}

function cancelReason(model: ServiceModel): string | null {
  const response = model.myProposal?.clientRejectionResponse;
  if (response) return response;
  if (model.requestStatus === "CANCELLED") return "Cliente desistiu da execução";
  if (model.contracted?.status === "CANCELLED") return "Serviço cancelado";
  if (model.myProposal?.status === "REJECTED") return "Cliente optou por outro profissional";
  return null;
}

function pushSecondaryInfo(
  items: ProviderCardSecondaryInfo[],
  entry: { icon?: ProviderCardInfoIcon; text: string | null | undefined },
): void {
  if (!entry.text?.trim()) return;
  items.push({ icon: entry.icon, text: entry.text.trim() });
}

function buildUnreadMessageHighlight(
  lastPreview: string | null | undefined,
): ProviderCardHighlight {
  return {
    icon: "new_message",
    title: "Nova mensagem recebida",
    messagePreview: lastPreview ?? undefined,
    emphasis: "attention",
  };
}

function buildNegotiationPresentation(
  model: ServiceModel,
): Pick<ProviderServiceCardPresentation, "highlight" | "secondaryInfo"> {
  const secondaryInfo: ProviderCardSecondaryInfo[] = [];
  const amount = proposalAmount(model);
  const location = neighborhoodCity(model);
  const isUnread = model.chatSummary?.isUnread ?? false;
  const proposalStatus = model.myProposal?.status;
  const lastPreview = model.chatSummary?.lastMessagePreview;
  const lastInteraction = model.chatSummary?.lastInteractionAt;

  if (isUnread) {
    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });

    return {
      highlight: buildUnreadMessageHighlight(lastPreview),
      secondaryInfo,
    };
  }

  if (proposalStatus === "REVISION_REQUESTED") {
    const reasonLabel = model.myProposal?.revisionReason
      ? getProposalRevisionReasonLabel(model.myProposal.revisionReason)
      : null;

    pushSecondaryInfo(secondaryInfo, { icon: "tag", text: reasonLabel });
    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });

    return {
      highlight: {
        icon: "revision",
        title: "Cliente solicitou revisão",
        emphasis: "attention",
      },
      secondaryInfo,
    };
  }

  if (
    proposalStatus === "PENDING" ||
    proposalStatus === "REVISED" ||
    model.hasPendingProposal
  ) {
    const submittedAt = formatClosedDate(
      model.myProposal?.submittedAt ?? model.myProposal?.updatedAt,
    );

    const expiring = isProposalExpiringSoon(model.myProposal?.expiredAt ?? null);
    const submittedLine = submittedAt
      ? `Proposta enviada em ${submittedAt}${expiring ? " · Expira em breve" : ""}`
      : expiring
        ? "Sua proposta expira em breve"
        : null;

    pushSecondaryInfo(secondaryInfo, { icon: "location", text: location });
    pushSecondaryInfo(secondaryInfo, { icon: "amount", text: amount });

    return {
      highlight: {
        icon: "waiting",
        title: "Aguardando decisão do cliente sobre sua proposta",
        detail: submittedLine ?? undefined,
        emphasis: expiring ? "attention" : "default",
      },
      secondaryInfo,
    };
  }

  if (proposalStatus === 'EXPIRED') {
    return {
      highlight: {
        icon: "waiting",
        title: "Proposta expirada",
        detail: `Proposta expirada em ${formatClosedDate(model.myProposal?.expiredAt)}. Envie uma nova proposta caso ainda queira realizar o serviço.`,
        emphasis: "attention",
      },
      secondaryInfo,
    };
  }

  if (model.chatSummary) {
    const relative = lastInteraction ? formatRelativeDate(lastInteraction) : null;

    return {
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
    highlight: {
      icon: "conversation",
      title: "Inicie a conversa com o cliente",
      emphasis: "default",
    },
    secondaryInfo,
  };
}

function buildCompletionFollowUpHighlight(
  status: ContractedServiceStatus | undefined,
  timing: ReturnType<typeof getScheduledTiming>,
): ProviderCardHighlight | null {
  // After mark-executed, wait for client confirmation/rating (schedule no longer relevant).
  if (status === "EXECUTED") {
    return {
      icon: "waiting",
      title: "Aguardando confirmação do cliente",
      detail: "Aguardando a confirmação e avaliação do cliente",
      emphasis: "default",
    };
  }

  // Past scheduled end (end defaults to start for all-day) → prompt mark-executed + evidence.
  if (status === "CONFIRMED" && timing === "past") {
    return {
      icon: "completed",
      title: "Marque o serviço como executado",
      detail: "Adicione as evidências de conclusão para finalizar o serviço",
      emphasis: "attention",
    };
  }

  return null;
}

function buildInProgressPresentation(
  model: ServiceModel,
): Pick<ProviderServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService"> {
  const secondaryInfo: ProviderCardSecondaryInfo[] = [];
  const contracted = model.contracted;
  const amount = proposalAmount(model);
  const address = fullAddress(model);
  const scheduleHighlight = contracted ? getScheduleHighlightContent(contracted) : null;
  const timing = contracted?.scheduledStartDate
    ? getScheduledTiming(contracted.scheduledStartDate, contracted.scheduledEndDate)
    : "future";
  const paymentPending = contracted?.status === "PENDING_PAYMENT";
  const isUnread = model.chatSummary?.isUnread ?? false;
  const lastPreview = model.chatSummary?.lastMessagePreview;
  const isTodayService = timing === "today";
  const completionHighlight = buildCompletionFollowUpHighlight(contracted?.status, timing);

  pushSecondaryInfo(secondaryInfo, {
    icon: "location",
    text: address ?? neighborhoodCity(model),
  });
  pushSecondaryInfo(secondaryInfo, { icon: "amount", text: amount });

  if (isUnread) {
    pushSecondaryInfo(secondaryInfo, {
      icon: completionHighlight?.title ? "info" : "date",
      text: completionHighlight?.title ?? scheduleHighlight?.title,
    });

    return {
      isTodayService,
      highlight: buildUnreadMessageHighlight(lastPreview),
      secondaryInfo,
    };
  }

  if (paymentPending && contracted) {
    const pendingPayment = getPendingPaymentHighlightContent(contracted, "provider");
    return {
      isTodayService,
      highlight: {
        icon: "payment_pending",
        title: pendingPayment.title,
        detail: pendingPayment.detail,
        emphasis: "attention",
      },
      secondaryInfo,
    };
  }

  if (completionHighlight) {
    return {
      isTodayService,
      highlight: completionHighlight,
      secondaryInfo,
    };
  }

  const highlightIcon: ProviderCardHighlightIcon =
    timing === "today" ? "today" : "scheduled";

  return {
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
): Pick<ProviderServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService"> {
  const secondaryInfo: ProviderCardSecondaryInfo[] = [];
  const amount = proposalAmount(model);
  const executedAt =
    formatClosedDate(model.completedAt) ??
    formatClosedDate(model.contracted?.updatedAt);

  pushSecondaryInfo(secondaryInfo, { icon: "amount", text: amount });
  pushSecondaryInfo(secondaryInfo, { icon: "date", text: `Concluído em ${executedAt}` });
  const ratingScore = model.contracted?.clientRatingOverallScore;
  pushSecondaryInfo(secondaryInfo, {
    icon: "rating",
    text: ratingScore != null ? ratingScore.toFixed(1) : null,
  });

  return {
    isTodayService: false,
    highlight: null,
    secondaryInfo,
  };
}

function buildCancelledPresentation(
  model: ServiceModel,
): Pick<ProviderServiceCardPresentation, "highlight" | "secondaryInfo" | "isTodayService"> {
  const cancelledAt =
    formatClosedDate(model.cancelledAt) ??
    formatClosedDate(model.contracted?.updatedAt);
  const reason = cancelReason(model);

  return {
    isTodayService: false,
    highlight: {
      icon: "cancelled",
      title: "Serviço cancelado",
      detail: reason ?? undefined,
      subdetail: cancelledAt ? `Cancelado em ${cancelledAt}` : undefined,
      emphasis: "cancelled",
    },
    secondaryInfo: [],
  };
}

function chatDisabled(model: ServiceModel): boolean {
  return !model.chatSummary?.id;
}

function chatAction(model: ServiceModel, label = "Ver conversa"): ProviderCardAction {
  const disabled = chatDisabled(model);
  return {
    label,
    intent: "chat",
    disabled,
    disabledReason: disabled ? "Conversa ainda não disponível para este pedido" : undefined,
  };
}

function openMapAction(): ProviderCardAction {
  return {
    label: "Abrir no mapa",
    intent: "open_map",
  };
}

function buildNegotiationActions(
  model: ServiceModel,
): Pick<ProviderServiceCardPresentation, "primaryAction" | "secondaryAction"> {
  const isUnread = model.chatSummary?.isUnread ?? false;
  const proposalStatus = model.myProposal?.status;

  if (isUnread) {
    return {
      primaryAction: { label: "Responder", intent: "chat", disabled: chatDisabled(model) },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  if (proposalStatus === "REVISION_REQUESTED") {
    return {
      primaryAction: { label: "Revisar proposta", intent: "revise_proposal" },
      secondaryAction: chatAction(model, "Ver negociação"),
    };
  }

  if (
    proposalStatus === "PENDING" ||
    proposalStatus === "REVISED" ||
    model.hasPendingProposal
  ) {
    return {
      primaryAction: { label: "Ver proposta", intent: "view_proposal" },
      secondaryAction: chatAction(model, "Ver negociação"),
    };
  }

  return {
    primaryAction: chatAction(model, "Ver negociação"),
    secondaryAction: { label: "Ver detalhes", intent: "details" },
  };
}

function buildInProgressActions(
  model: ServiceModel,
): Pick<ProviderServiceCardPresentation, "primaryAction" | "secondaryAction"> {
  if (model.chatSummary?.isUnread) {
    return {
      primaryAction: { label: "Responder", intent: "chat", disabled: chatDisabled(model) },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  const timing = model.contracted?.scheduledStartDate
    ? getScheduledTiming(
        model.contracted.scheduledStartDate,
        model.contracted.scheduledEndDate,
      )
    : "future";
  const status = model.contracted?.status;

  // Past schedule + CONFIRMED → open mark-executed checklist from the card.
  if (status === "CONFIRMED" && timing === "past") {
    const enrichmentReady = model.enrichmentReady;
    return {
      primaryAction: {
        label: "Concluir serviço",
        intent: "mark_executed",
        disabled: !enrichmentReady,
        disabledReason: enrichmentReady
          ? undefined
          : "Checklist de conclusão ainda não está pronto",
      },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  if (status === "EXECUTED") {
    return {
      primaryAction: { label: "Ver detalhes", intent: "details" },
      secondaryAction: chatAction(model),
    };
  }

  const isTodayService = timing === "today";
  const hasCoordinates = getServiceCoordinates(model.address) !== null;

  if (isTodayService) {
    return {
      primaryAction: {
        ...openMapAction(),
        disabled: !hasCoordinates,
        disabledReason: hasCoordinates
          ? undefined
          : "Localização do serviço indisponível",
      },
      secondaryAction: { label: "Concluir serviço", intent: "mark_executed" },
    };
  }

  return {
    primaryAction: chatAction(model),
    secondaryAction: { label: "Ver detalhes", intent: "details" },
  };
}

function buildCompletedActions(): Pick<
  ProviderServiceCardPresentation,
  "primaryAction" | "secondaryAction"
> {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildCancelledActions(): Pick<
  ProviderServiceCardPresentation,
  "primaryAction" | "secondaryAction"
> {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

export function getProviderServiceCardPresentation(
  model: ServiceModel,
): ProviderServiceCardPresentation {
  const phaseLabel = getStatusLabel(model.listPhase, model.hasPendingProposal);
  const phaseBadgeVariant = getStatusBadgeVariant(model.listPhase, model.proposalCount);

  let content: Pick<
    ProviderServiceCardPresentation,
    "highlight" | "secondaryInfo" | "isTodayService"
  >;
  let actions: Pick<ProviderServiceCardPresentation, "primaryAction" | "secondaryAction">;

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
