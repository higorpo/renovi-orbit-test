import { describe, expect, it } from "vitest";
import type { Profile } from "@/features/auth";
import type { ConversationDetailResponse } from "../../types/chats.types";
import {
  buildChatDetailsParticipants,
  getChatParticipantRoleLabel,
} from "../chatDetailsCopy";

const baseDetail: ConversationDetailResponse = {
  conversation: {
    id: "chat-1",
    service_request_id: "sr-1",
    client_id: "client-1",
    provider_id: "provider-1",
    status: "ACTIVE",
    last_interaction_at: "2026-06-01T12:00:00Z",
    activated_at: "2026-06-01T10:00:00Z",
    inactivated_at: null,
    inactivation_reason: null,
    closed_at: null,
    closure_type: null,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-01T12:00:00Z",
  },
  counterparty: {
    id: "provider-1",
    full_name: "João Prestador",
    profile_image_path: null,
    role: "provider",
  },
  service_request: {
    id: "sr-1",
    title: "Trocar tomada",
  },
  service: {
    id: "service-1",
    title: "Eletricista",
    slug: "eletricista",
    icon_key: null,
    color_key: null,
    image_url: null,
  },
  category: null,
  counterparty_read_receipt: null,
  accepted_proposal: null,
};

const clientProfile: Profile = {
  id: "client-1",
  role: "client",
  full_name: "Maria Cliente",
  profile_image_path: null,
};

describe("chatDetailsCopy", () => {
  it("maps participant role labels", () => {
    expect(getChatParticipantRoleLabel("client")).toBe("Cliente");
    expect(getChatParticipantRoleLabel("provider")).toBe("Prestador");
    expect(getChatParticipantRoleLabel("admin")).toBe("Participante");
  });

  it("builds client and provider participants for a client viewer", () => {
    const participants = buildChatDetailsParticipants(baseDetail, clientProfile);

    expect(participants).toHaveLength(2);
    expect(participants[0]).toMatchObject({
      id: "client-1",
      role: "client",
      isCurrentUser: true,
    });
    expect(participants[1]).toMatchObject({
      id: "provider-1",
      role: "provider",
      isCurrentUser: false,
    });
  });

  it("builds participants for a provider viewer using counterparty as client", () => {
    const providerProfile: Profile = {
      id: "provider-1",
      role: "provider",
      full_name: "João Prestador",
      profile_image_path: "avatars/joao.png",
    };
    const detail: ConversationDetailResponse = {
      ...baseDetail,
      counterparty: {
        id: "client-1",
        full_name: null,
        profile_image_path: null,
        role: "client",
      },
    };

    const participants = buildChatDetailsParticipants(detail, providerProfile);

    expect(participants[0]).toMatchObject({
      id: "client-1",
      fullName: "Cliente",
      role: "client",
      isCurrentUser: false,
    });
    expect(participants[1]).toMatchObject({
      id: "provider-1",
      fullName: "João Prestador",
      profileImagePath: "avatars/joao.png",
      role: "provider",
      isCurrentUser: true,
    });
  });
});
