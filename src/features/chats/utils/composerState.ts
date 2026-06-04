import type { ProfileRole } from "@/features/auth";
import type { CnsConversationStatus } from "../types/chats.types";

export const CHAT_COMPOSER_PLACEHOLDER_ENABLED = "Escreva uma mensagem…";
export const CHAT_COMPOSER_PLACEHOLDER_BLOCKED = "Bloqueado";

export const CHAT_COMPOSER_DISABLED_COPY = {
  pendingProposalClient:
    "Há uma proposta pendente. Responda na proposta acima: aceite, peça revisão ou recuse.",
  pendingProposalProvider:
    "Há uma proposta pendente. Aguarde a resposta do cliente para continuar a conversa.",
  conversationClosed: "Esta conversa foi encerrada.",
  conversationInactiveClient:
    "A conversa está inativa. Envie uma mensagem para retomar a negociação.",
  conversationInactiveProvider:
    "A conversa está inativa. Envie uma mensagem para retomar a negociação.",
} as const;

export function resolvePendingProposalComposerCopy(viewerRole: ProfileRole): string {
  return viewerRole === "provider"
    ? CHAT_COMPOSER_DISABLED_COPY.pendingProposalProvider
    : CHAT_COMPOSER_DISABLED_COPY.pendingProposalClient;
}

export function resolveInactiveConversationComposerCopy(viewerRole: ProfileRole): string {
  return viewerRole === "provider"
    ? CHAT_COMPOSER_DISABLED_COPY.conversationInactiveProvider
    : CHAT_COMPOSER_DISABLED_COPY.conversationInactiveClient;
}

export type ChatComposerDisabledReason =
  | "loading"
  | "pending_proposal"
  | "conversation_closed"
  | null;

export interface ChatComposerState {
  isInputEnabled: boolean;
  isAttachmentEnabled: boolean;
  isSendEnabled: boolean;
  disabledReason: ChatComposerDisabledReason;
  helperText: string | null;
  placeholder: string;
}

export function deriveChatComposerState(params: {
  freeMessagingAllowed: boolean | undefined;
  conversationStatus: CnsConversationStatus | null;
  isLoading: boolean;
  viewerRole?: ProfileRole;
}): ChatComposerState {
  if (params.isLoading || params.freeMessagingAllowed === undefined) {
    return {
      isInputEnabled: false,
      isAttachmentEnabled: false,
      isSendEnabled: false,
      disabledReason: "loading",
      helperText: null,
      placeholder: CHAT_COMPOSER_PLACEHOLDER_ENABLED,
    };
  }

  if (params.conversationStatus === "CLOSED") {
    return {
      isInputEnabled: false,
      isAttachmentEnabled: false,
      isSendEnabled: false,
      disabledReason: "conversation_closed",
      helperText: CHAT_COMPOSER_DISABLED_COPY.conversationClosed,
      placeholder: CHAT_COMPOSER_DISABLED_COPY.conversationClosed,
    };
  }

  if (!params.freeMessagingAllowed) {
    const pendingProposalHelperText = resolvePendingProposalComposerCopy(
      params.viewerRole ?? "client",
    );

    return {
      isInputEnabled: false,
      isAttachmentEnabled: false,
      isSendEnabled: false,
      disabledReason: "pending_proposal",
      helperText: pendingProposalHelperText,
      placeholder: CHAT_COMPOSER_PLACEHOLDER_BLOCKED,
    };
  }

  const inactiveHelperText =
    params.conversationStatus === "INACTIVE"
      ? resolveInactiveConversationComposerCopy(params.viewerRole ?? "client")
      : null;

  return {
    isInputEnabled: true,
    isAttachmentEnabled: true,
    isSendEnabled: true,
    disabledReason: null,
    helperText: inactiveHelperText,
    placeholder: CHAT_COMPOSER_PLACEHOLDER_ENABLED,
  };
}
