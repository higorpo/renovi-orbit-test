import type { Profile, ProfileRole } from "@/features/auth";
import type { ConversationDetailResponse } from "../types/chats.types";

export interface ChatDetailsParticipant {
  id: string;
  fullName: string;
  profileImagePath: string | null;
  role: ProfileRole;
  isCurrentUser: boolean;
}

export function getChatParticipantRoleLabel(role: ProfileRole): string {
  if (role === "provider") return "Prestador";
  if (role === "client") return "Cliente";
  return "Participante";
}

export function buildChatDetailsParticipants(
  detail: ConversationDetailResponse,
  currentUser: Profile,
): ChatDetailsParticipant[] {
  const isViewerClient = currentUser.id === detail.conversation.client_id;

  const client: ChatDetailsParticipant = isViewerClient
    ? {
        id: currentUser.id,
        fullName: currentUser.full_name,
        profileImagePath: currentUser.profile_image_path ?? null,
        role: "client",
        isCurrentUser: true,
      }
    : {
        id: detail.counterparty.id,
        fullName: detail.counterparty.full_name?.trim() || "Cliente",
        profileImagePath: detail.counterparty.profile_image_path,
        role: "client",
        isCurrentUser: false,
      };

  const provider: ChatDetailsParticipant = isViewerClient
    ? {
        id: detail.counterparty.id,
        fullName: detail.counterparty.full_name?.trim() || "Prestador",
        profileImagePath: detail.counterparty.profile_image_path,
        role: "provider",
        isCurrentUser: false,
      }
    : {
        id: currentUser.id,
        fullName: currentUser.full_name,
        profileImagePath: currentUser.profile_image_path ?? null,
        role: "provider",
        isCurrentUser: true,
      };

  return [client, provider];
}

export function formatChatDetailsLocation(
  address: ConversationDetailResponse["address"],
): string {
  return [address.neighborhood, address.city, address.state].filter(Boolean).join(", ");
}

export const CHAT_DETAILS_DISCLAIMER = {
  title: "Coisas para ter em mente",
  body:
    "Esta conversa existe para facilitar a negociação entre cliente e prestador sobre o pedido de serviço. " +
    "Podemos analisar as mensagens por motivos de segurança, suporte e para aprimorar nossos serviços.",
} as const;
