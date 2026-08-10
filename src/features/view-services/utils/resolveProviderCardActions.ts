import { getScheduledTiming } from "./formatScheduledSummary";
import { getServiceCoordinates } from "./serviceLocation";
import type { ServiceModel } from "../types/service.types";

export type ProviderServiceActionIntent =
  | "chat"
  | "details"
  | "open_map"
  | "revise_proposal"
  | "view_proposal"
  | "mark_executed";

export interface ProviderServiceCardAction {
  label: string;
  intent: ProviderServiceActionIntent;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ProviderServiceCardActions {
  primaryAction: ProviderServiceCardAction;
  secondaryAction: ProviderServiceCardAction | null;
}

function chatDisabled(model: ServiceModel): boolean {
  return !model.chatSummary?.id;
}

function chatAction(model: ServiceModel, label = "Ver conversa"): ProviderServiceCardAction {
  const disabled = chatDisabled(model);
  return {
    label,
    intent: "chat",
    disabled,
    disabledReason: disabled ? "Conversa ainda não disponível para este pedido" : undefined,
  };
}

function openMapAction(): ProviderServiceCardAction {
  return {
    label: "Abrir no mapa",
    intent: "open_map",
  };
}

function buildNegotiationActions(model: ServiceModel): ProviderServiceCardActions {
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

function buildInProgressActions(model: ServiceModel): ProviderServiceCardActions {
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

  if (status === "IN_DISPUTE") {
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

function buildCompletedActions(): ProviderServiceCardActions {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildCancelledActions(): ProviderServiceCardActions {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: null,
  };
}

function buildDisputeActions(model: ServiceModel): ProviderServiceCardActions {
  return {
    primaryAction: { label: "Ver detalhes", intent: "details" },
    secondaryAction: chatAction(model),
  };
}

/** Shared ranking for list card primary/secondary CTAs (provider). */
export function resolveProviderCardActions(model: ServiceModel): ProviderServiceCardActions {
  switch (model.listPhase) {
    case "in_progress":
      return buildInProgressActions(model);
    case "completed":
      return buildCompletedActions();
    case "cancelled":
      return buildCancelledActions();
    case "dispute":
      return buildDisputeActions(model);
    default:
      return buildNegotiationActions(model);
  }
}

/** Primary intent only — used by next-step and list presentation. */
export function resolveProviderPrimaryIntent(
  model: ServiceModel,
): ProviderServiceCardAction {
  return resolveProviderCardActions(model).primaryAction;
}
