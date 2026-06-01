import type { ChatMessageListItem } from "../types/chats.types";

export function getChatMessageText(message: ChatMessageListItem): string {
  if (message.message_type === "TEXT") {
    const text = message.payload.text;
    if (typeof text === "string" && text.trim()) return text.trim();
    return "Mensagem";
  }

  const preview = message.payload.preview;
  if (typeof preview === "string" && preview.trim()) return preview.trim();

  return "Mensagem";
}
