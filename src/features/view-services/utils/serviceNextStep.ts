import { getPendingPaymentHighlightContent } from "./pendingPaymentHighlight";
import {
  resolveClientPrimaryIntent,
  type ClientServiceActionIntent,
  type ClientServiceCardAction,
} from "./resolveClientCardActions";
import {
  resolveProviderPrimaryIntent,
  type ProviderServiceActionIntent,
  type ProviderServiceCardAction,
} from "./resolveProviderCardActions";
import { getServiceRequestBudgetActionState } from "./serviceRequestBudgetAction";
import type { ServiceModel } from "../types/service.types";

export type ClientServiceNextStepIntent = Extract<
  ClientServiceActionIntent,
  "adjust_payment" | "evaluate_service" | "budgets" | "chat" | "messages"
>;

export type ProviderServiceNextStepIntent = Extract<
  ProviderServiceActionIntent,
  "chat" | "revise_proposal" | "view_proposal" | "mark_executed" | "open_map"
>;

export type ServiceNextStepIntent =
  | ClientServiceNextStepIntent
  | ProviderServiceNextStepIntent;

export type ServiceNextStepIcon =
  | "credit_card"
  | "star"
  | "file_text"
  | "message"
  | "check_circle"
  | "map_pin"
  | "pencil"
  | "eye";

export type ServiceNextStepTrustFooter = {
  icon: "lock" | "shield";
  text: string;
};

export type ServiceNextStep = {
  intent: ServiceNextStepIntent;
  eyebrow: "Próximo passo";
  title: string;
  description: string;
  actionLabel: string;
  icon: ServiceNextStepIcon;
  trustFooter?: ServiceNextStepTrustFooter;
  disabled?: boolean;
  disabledReason?: string;
};

const CLIENT_ACTIONABLE = new Set<ClientServiceActionIntent>([
  "adjust_payment",
  "evaluate_service",
  "budgets",
  "chat",
  "messages",
]);

const PROVIDER_ACTIONABLE = new Set<ProviderServiceActionIntent>([
  "chat",
  "revise_proposal",
  "view_proposal",
  "mark_executed",
  "open_map",
]);

function isClientNextStepIntent(
  intent: ClientServiceActionIntent,
): intent is ClientServiceNextStepIntent {
  return CLIENT_ACTIONABLE.has(intent);
}

function isProviderNextStepIntent(
  intent: ProviderServiceActionIntent,
): intent is ProviderServiceNextStepIntent {
  return PROVIDER_ACTIONABLE.has(intent);
}

function withActionState(
  step: Omit<ServiceNextStep, "disabled" | "disabledReason">,
  action: ClientServiceCardAction | ProviderServiceCardAction,
): ServiceNextStep {
  return {
    ...step,
    disabled: action.disabled,
    disabledReason: action.disabledReason,
  };
}

function buildClientBudgetsStep(
  model: ServiceModel,
  action: ClientServiceCardAction,
): ServiceNextStep {
  const pendingCount = model.pendingProposalCount;
  const proposalCount = model.proposalCount;
  const budgetLabel = getServiceRequestBudgetActionState(model).label;

  if (pendingCount > 0) {
    return withActionState(
      {
        intent: "budgets",
        eyebrow: "Próximo passo",
        title:
          pendingCount === 1
            ? "Novo orçamento para analisar"
            : "Novos orçamentos para analisar",
        description:
          pendingCount === 1
            ? "1 orçamento aguardando sua resposta"
            : `${pendingCount} orçamentos aguardando sua resposta`,
        actionLabel: budgetLabel,
        icon: "file_text",
        trustFooter: {
          icon: "shield",
          text: "Compare com tranquilidade — sem compromisso",
        },
      },
      action,
    );
  }

  return withActionState(
    {
      intent: "budgets",
      eyebrow: "Próximo passo",
      title: proposalCount === 1 ? "Orçamento recebido" : "Orçamentos recebidos",
      description: "Compare valores e prazos antes de decidir",
      actionLabel: budgetLabel,
      icon: "file_text",
      trustFooter: {
        icon: "shield",
        text: "Compare com tranquilidade — sem compromisso",
      },
    },
    action,
  );
}

function buildClientChatStep(
  model: ServiceModel,
  action: ClientServiceCardAction,
  intent: "chat" | "messages",
): ServiceNextStep {
  const unreadCount = model.unreadChatCount;
  const providerLabel = model.chatSummary?.providerDisplayName?.trim();

  if (unreadCount > 0) {
    const title =
      unreadCount === 1 && providerLabel
        ? `Nova mensagem de ${providerLabel}`
        : "Mensagens novas de prestadores";

    return withActionState(
      {
        intent,
        eyebrow: "Próximo passo",
        title,
        description:
          model.chatSummary?.lastMessagePreview?.trim() ||
          (unreadCount > 1
            ? `${unreadCount} conversas com mensagens novas`
            : "Responda para continuar a negociação"),
        actionLabel: action.label,
        icon: "message",
      },
      action,
    );
  }

  return withActionState(
    {
      intent,
      eyebrow: "Próximo passo",
      title: "Fale com o prestador",
      description: "Tire dúvidas e alinhe os detalhes do serviço",
      actionLabel: action.label,
      icon: "message",
    },
    action,
  );
}

function buildClientEvaluateStep(
  model: ServiceModel,
  action: ClientServiceCardAction,
): ServiceNextStep {
  const status = model.contracted?.status;

  if (status === "EXECUTED") {
    return withActionState(
      {
        intent: "evaluate_service",
        eyebrow: "Próximo passo",
        title: "Aceite a conclusão e avalie o serviço",
        description:
          "O prestador enviou as evidências — confirme a conclusão e deixe sua avaliação",
        actionLabel: action.label,
        icon: "star",
      },
      action,
    );
  }

  return withActionState(
    {
      intent: "evaluate_service",
      eyebrow: "Próximo passo",
      title: "Avalie o serviço",
      description: "O serviço foi concluído. Você ainda pode deixar uma avaliação",
      actionLabel: action.label,
      icon: "star",
    },
    action,
  );
}

export function getClientServiceNextStep(model: ServiceModel): ServiceNextStep | null {
  const primary = resolveClientPrimaryIntent(model);
  if (!isClientNextStepIntent(primary.intent)) return null;

  switch (primary.intent) {
    case "adjust_payment": {
      if (!model.contracted) return null;
      const pending = getPendingPaymentHighlightContent(model.contracted, "client");
      return withActionState(
        {
          intent: "adjust_payment",
          eyebrow: "Próximo passo",
          title: "Pagamento pendente",
          description: pending.detail,
          actionLabel: "Pagar agora",
          icon: "credit_card",
          trustFooter: {
            icon: "lock",
            text: "Ambiente seguro e criptografado",
          },
        },
        primary,
      );
    }
    case "evaluate_service":
      return buildClientEvaluateStep(model, primary);
    case "budgets":
      return buildClientBudgetsStep(model, primary);
    case "chat":
    case "messages":
      return buildClientChatStep(model, primary, primary.intent);
  }
}

function buildProviderChatStep(
  model: ServiceModel,
  action: ProviderServiceCardAction,
): ServiceNextStep {
  if (model.chatSummary?.isUnread) {
    return withActionState(
      {
        intent: "chat",
        eyebrow: "Próximo passo",
        title: "Nova mensagem recebida",
        description:
          model.chatSummary.lastMessagePreview?.trim() ||
          "Responda o cliente para continuar a negociação",
        actionLabel: action.label,
        icon: "message",
      },
      action,
    );
  }

  return withActionState(
    {
      intent: "chat",
      eyebrow: "Próximo passo",
      title: "Fale com o cliente",
      description: "Continue a negociação ou tire dúvidas sobre o serviço",
      actionLabel: action.label,
      icon: "message",
    },
    action,
  );
}

export function getProviderServiceNextStep(model: ServiceModel): ServiceNextStep | null {
  const primary = resolveProviderPrimaryIntent(model);
  if (!isProviderNextStepIntent(primary.intent)) return null;

  switch (primary.intent) {
    case "chat":
      return buildProviderChatStep(model, primary);
    case "revise_proposal":
      return withActionState(
        {
          intent: "revise_proposal",
          eyebrow: "Próximo passo",
          title: "Cliente solicitou revisão",
          description: "Atualize sua proposta com os ajustes pedidos",
          actionLabel: primary.label,
          icon: "pencil",
        },
        primary,
      );
    case "view_proposal":
      return withActionState(
        {
          intent: "view_proposal",
          eyebrow: "Próximo passo",
          title: "Acompanhe sua proposta",
          description: "Veja os detalhes enviados e o status da análise",
          actionLabel: primary.label,
          icon: "eye",
        },
        primary,
      );
    case "mark_executed":
      return withActionState(
        {
          intent: "mark_executed",
          eyebrow: "Próximo passo",
          title: "Marque o serviço como executado",
          description: "Adicione as evidências de conclusão para finalizar o serviço",
          actionLabel: primary.label,
          icon: "check_circle",
        },
        primary,
      );
    case "open_map":
      return withActionState(
        {
          intent: "open_map",
          eyebrow: "Próximo passo",
          title: "Serviço hoje",
          description: "Abra o mapa para ir até o local do serviço",
          actionLabel: primary.label,
          icon: "map_pin",
        },
        primary,
      );
  }
}

export function getServiceNextStep(
  model: ServiceModel,
  role: "client" | "provider" | string | null | undefined,
): ServiceNextStep | null {
  if (role === "client") return getClientServiceNextStep(model);
  if (role === "provider") return getProviderServiceNextStep(model);
  return null;
}
