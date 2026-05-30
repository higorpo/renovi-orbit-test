import { useEffect } from "react";
import { isSentryEnabled, Sentry } from "@/lib/sentry";

export type ChatSentryContext = {
  chatId?: string | null;
  serviceRequestId?: string | null;
};

export function setChatSentryContext(context: ChatSentryContext): void {
  if (!isSentryEnabled()) return;

  Sentry.setTag("feature", "chats");

  if (context.chatId) {
    Sentry.setTag("chat_id", context.chatId);
  } else {
    Sentry.setTag("chat_id", undefined);
  }

  if (context.serviceRequestId) {
    Sentry.setTag("service_request_id", context.serviceRequestId);
  } else {
    Sentry.setTag("service_request_id", undefined);
  }

  Sentry.setContext("chat", {
    chat_id: context.chatId ?? undefined,
    service_request_id: context.serviceRequestId ?? undefined,
  });
}

export function clearChatSentryContext(): void {
  if (!isSentryEnabled()) return;

  Sentry.setTag("feature", undefined);
  Sentry.setTag("chat_id", undefined);
  Sentry.setTag("service_request_id", undefined);
  Sentry.setContext("chat", null);
}

export function useChatSentryContext(context: ChatSentryContext): void {
  const { chatId, serviceRequestId } = context;

  useEffect(() => {
    setChatSentryContext({ chatId, serviceRequestId });
    return () => clearChatSentryContext();
  }, [chatId, serviceRequestId]);
}
