import type { CnsConversationStatus } from "../types/chats.types";

export const CHAT_COMPOSER_PLACEHOLDER_ENABLED = "Escreva uma mensagem…";

export const CHAT_COMPOSER_DISABLED_COPY = {
  pendingProposal:
    "Há uma proposta pendente. Use o card da proposta acima para aceitar, pedir revisão ou recusar.",
  conversationClosed: "Esta conversa foi encerrada.",
  conversationInactive: "A conversa está inativa. Envie uma proposta para retomar.",
} as const;

export type ChatComposerDisabledReason =
  | "loading"
  | "pending_proposal"
  | "conversation_closed"
  | "conversation_inactive"
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

  if (params.conversationStatus === "INACTIVE") {
    return {
      isInputEnabled: false,
      isAttachmentEnabled: false,
      isSendEnabled: false,
      disabledReason: "conversation_inactive",
      helperText: CHAT_COMPOSER_DISABLED_COPY.conversationInactive,
      placeholder: CHAT_COMPOSER_DISABLED_COPY.conversationInactive,
    };
  }

  if (!params.freeMessagingAllowed) {
    return {
      isInputEnabled: false,
      isAttachmentEnabled: false,
      isSendEnabled: false,
      disabledReason: "pending_proposal",
      helperText: CHAT_COMPOSER_DISABLED_COPY.pendingProposal,
      placeholder: CHAT_COMPOSER_DISABLED_COPY.pendingProposal,
    };
  }

  return {
    isInputEnabled: true,
    isAttachmentEnabled: true,
    isSendEnabled: true,
    disabledReason: null,
    helperText: null,
    placeholder: CHAT_COMPOSER_PLACEHOLDER_ENABLED,
  };
}
