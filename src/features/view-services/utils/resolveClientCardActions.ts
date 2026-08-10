import { getScheduledTiming } from "./formatScheduledSummary";
import { getServiceRequestBudgetActionState } from "./serviceRequestBudgetAction";
import type { ServiceModel } from "../types/service.types";

export type ClientServiceActionIntent =
  | "details"
  | "budgets"
  | "cancel"
  | "messages"
  | "chat"
  | "adjust_payment"
  | "evaluate_service";

export interface ClientServiceCardAction {
  label: string;
  intent: ClientServiceActionIntent;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ClientServiceCardActions {
  primaryAction: ClientServiceCardAction;
  secondaryAction: ClientServiceCardAction | null;
}

function chatDisabled(model: ServiceModel): boolean {
  return !model.chatSummary?.id;
}

function chatAction(model: ServiceModel, label = "Ver conversa com prestador"): ClientServiceCardAction {
  const disabled = chatDisabled(model);
  return {
    label,
    intent: "chat",
    disabled,
    disabledReason: disabled ? "Conversa ainda não disponível para este pedido" : undefined,
  };
}

function unreadMessagesAction(model: ServiceModel): ClientServiceCardAction {
  const latestChat = model.chatSummary;
  const providerLabel = latestChat?.providerDisplayName?.trim();
  const singleUnreadChat =
    model.unreadChatCount === 1 && Boolean(providerLabel) && Boolean(latestChat?.id);

  if (singleUnreadChat) {
    return { label: "Ver mensagem", intent: "chat" };
  }

  return { label: "Ver mensagens", intent: "messages" };
}

function budgetsAction(model: ServiceModel): ClientServiceCardAction {
  const action = getServiceRequestBudgetActionState(model);

  return {
    label: action.label,
    intent: "budgets",
    disabled: action.disabled,
    disabledReason: action.disabledReason,
  };
}

function buildNegotiationActions(model: ServiceModel): ClientServiceCardActions {
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

function buildInProgressActions(model: ServiceModel): ClientServiceCardActions {
  const needsManualPayment =
    model.contracted?.status === "PENDING_PAYMENT" &&
    model.contracted.paymentScheduleState === "FAILED_PERMANENT";

  if (needsManualPayment) {
    return {
      primaryAction: { label: "Ajustar pagamento", intent: "adjust_payment" },
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

  // Provider submitted evidence — evaluate outranks unread chat.
  if (status === "EXECUTED") {
    return {
      primaryAction: { label: "Avaliar serviço", intent: "evaluate_service" },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  if (model.chatSummary?.isUnread || model.unreadChatCount > 0) {
    return {
      primaryAction: chatAction(model, "Responder"),
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  // Dispute blocks evaluate / cancel CTAs — chat stays available.
  if (status === "IN_DISPUTE") {
    return {
      primaryAction: { label: "Ver detalhes", intent: "details" },
      secondaryAction: chatAction(model),
    };
  }

  // Waiting on provider completion — prefer details over chat.
  if (status === "CONFIRMED" && timing === "past") {
    return {
      primaryAction: { label: "Ver detalhes", intent: "details" },
      secondaryAction: chatAction(model),
    };
  }

  return {
    primaryAction: chatAction(model),
    secondaryAction: { label: "Ver detalhes", intent: "details" },
  };
}

function buildCompletedActions(model: ServiceModel): ClientServiceCardActions {
  // list_services already embeds rating fields — no extra fetch.
  const needsOptionalRating =
    model.contracted?.status === "COMPLETED" &&
    model.contracted.clientRatingOverallScore == null;

  if (needsOptionalRating) {
    return {
      primaryAction: { label: "Avaliar serviço", intent: "evaluate_service" },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    };
  }

  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildCancelledActions(): ClientServiceCardActions {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildDisputeActions(model: ServiceModel): ClientServiceCardActions {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: chatAction(model),
  };
}

/** Shared ranking for list card primary/secondary CTAs (client). */
export function resolveClientCardActions(model: ServiceModel): ClientServiceCardActions {
  switch (model.listPhase) {
    case "in_progress":
      return buildInProgressActions(model);
    case "completed":
      return buildCompletedActions(model);
    case "cancelled":
      return buildCancelledActions();
    case "dispute":
      return buildDisputeActions(model);
    default:
      return buildNegotiationActions(model);
  }
}

/** Primary intent only — used by next-step and list presentation. */
export function resolveClientPrimaryIntent(
  model: ServiceModel,
): ClientServiceCardAction {
  return resolveClientCardActions(model).primaryAction;
}
