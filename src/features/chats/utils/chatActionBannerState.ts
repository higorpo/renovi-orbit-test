import type { ProfileRole } from "@/features/auth";
import type { ProposalStatus } from "@/features/negotiation-proposals";
import type { CnsConversationStatus } from "../types/chats.types";

export type ChatActionBannerAction =
  | "review_proposal"
  | "send_proposal"
  | "view_proposal"
  | "propose_reschedule"
  | "close_conversation";

export interface ChatActionBannerModel {
  action: ChatActionBannerAction;
  body: string;
  ctaLabel: string;
  ctaAriaLabel: string;
  dismissAriaLabel: string;
  proposalId?: string;
  rescheduleRequestId?: string;
  priority: number;
}

export interface ChatActionBannerContext {
  viewerRole: ProfileRole;
  conversationStatus: CnsConversationStatus;
  /** Active PENDING proposal id, if any. */
  pendingProposalId: string | null;
  /** Proposal in REVISION_REQUESTED, if any. */
  revisionRequestedProposalId: string | null;
  /** Optional status of the primary proposal row driving the banner. */
  primaryProposalStatus?: ProposalStatus | null;
  /** Provider sent at least one message and the client replied once (R19 send-proposal gate). */
  canShowSendProposalBanner?: boolean;
  /** No chat interaction for 12+ hours (close-conversation gate for both roles). */
  canShowCloseConversationBanner?: boolean;
  /** Latest linked proposal status is still loading (avoid send-proposal flash). */
  isLatestProposalStatusPending?: boolean;
  /** Active reschedule request awaiting provider proposal. */
  rescheduleRequestId?: string | null;
  canProposeReschedule?: boolean;
}

const PRIORITY = {
  revision: 300,
  proposeReschedule: 250,
  sendProposal: 200,
  viewProposal: 100,
  closeConversation: 50,
} as const;

function buildProviderRevisionBanner(proposalId: string): ChatActionBannerModel {
  return {
    action: "review_proposal",
    priority: PRIORITY.revision,
    proposalId,
    body: "O cliente pediu alterações na sua proposta. Revise o pedido e envie uma versão atualizada.",
    ctaLabel: "Revisar proposta",
    ctaAriaLabel: "Revisar proposta solicitada pelo cliente",
    dismissAriaLabel: "Dispensar aviso de revisão de proposta",
  };
}

function buildProviderSendBanner(): ChatActionBannerModel {
  return {
    action: "send_proposal",
    priority: PRIORITY.sendProposal,
    body: "Já tem informações suficientes? Inclua valor, escopo e prazos para continuar a negociação.",
    ctaLabel: "Enviar proposta",
    ctaAriaLabel: "Enviar proposta para este pedido",
    dismissAriaLabel: "Dispensar aviso para enviar proposta",
  };
}

function buildProviderViewBanner(proposalId: string): ChatActionBannerModel {
  return {
    action: "view_proposal",
    priority: PRIORITY.viewProposal,
    proposalId,
    body: "Sua proposta está aguardando resposta do cliente. Você pode revisar os detalhes enviados.",
    ctaLabel: "Ver proposta",
    ctaAriaLabel: "Ver proposta enviada",
    dismissAriaLabel: "Dispensar aviso da proposta",
  };
}

function buildClientViewBanner(proposalId: string): ChatActionBannerModel {
  return {
    action: "view_proposal",
    priority: PRIORITY.viewProposal,
    proposalId,
    body: "O prestador enviou uma proposta. Revise valor, prazo e detalhes antes de responder.",
    ctaLabel: "Ver proposta",
    ctaAriaLabel: "Ver proposta recebida",
    dismissAriaLabel: "Dispensar aviso de proposta recebida",
  };
}

function shouldBlockProviderSendProposalBanner(
  status: ProposalStatus | null | undefined,
): boolean {
  return status === "ACCEPTED" || status === "PENDING" || status === "REVISION_REQUESTED";
}

function buildProviderProposeRescheduleBanner(requestId: string): ChatActionBannerModel {
  return {
    action: "propose_reschedule",
    priority: PRIORITY.proposeReschedule,
    rescheduleRequestId: requestId,
    body: "Há uma solicitação de reagendamento aguardando sua proposta de nova data.",
    ctaLabel: "Propor nova data",
    ctaAriaLabel: "Propor nova data de reagendamento",
    dismissAriaLabel: "Dispensar aviso de reagendamento",
  };
}

function buildCloseConversationBanner(): ChatActionBannerModel {
  return {
    action: "close_conversation",
    priority: PRIORITY.closeConversation,
    body: "Não há ações pendentes nesta conversa. Você pode continuar conversando ou encerrar se não quiser seguir.",
    ctaLabel: "Encerrar conversa",
    ctaAriaLabel: "Encerrar esta conversa",
    dismissAriaLabel: "Dispensar aviso de encerramento",
  };
}

/**
 * Returns the single highest-priority banner for the current chat context (R19-AC02).
 */
export function resolveChatActionBanner(
  context: ChatActionBannerContext,
): ChatActionBannerModel | null {
  if (context.conversationStatus === "CLOSED") {
    return null;
  }

  if (context.viewerRole === "provider") {
    if (context.revisionRequestedProposalId) {
      return buildProviderRevisionBanner(context.revisionRequestedProposalId);
    }

    if (context.rescheduleRequestId && context.canProposeReschedule) {
      return buildProviderProposeRescheduleBanner(context.rescheduleRequestId);
    }

    if (
      !context.pendingProposalId &&
      !shouldBlockProviderSendProposalBanner(context.primaryProposalStatus) &&
      context.conversationStatus === "ACTIVE" &&
      context.canShowSendProposalBanner &&
      !context.isLatestProposalStatusPending
    ) {
      return buildProviderSendBanner();
    }

    if (context.pendingProposalId && context.primaryProposalStatus === "PENDING") {
      return buildProviderViewBanner(context.pendingProposalId);
    }

    if (context.canShowCloseConversationBanner && context.conversationStatus === "ACTIVE") {
      return buildCloseConversationBanner();
    }

    return null;
  }

  if (context.viewerRole === "client") {
    if (context.pendingProposalId) {
      return buildClientViewBanner(context.pendingProposalId);
    }

    if (context.canShowCloseConversationBanner && context.conversationStatus === "ACTIVE") {
      return buildCloseConversationBanner();
    }

    return null;
  }

  return null;
}
