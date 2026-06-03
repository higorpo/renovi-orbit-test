import { describe, expect, it } from "vitest";
import type { Profile } from "@/features/auth";
import type { ConversationDetailResponse } from "../../types/chats.types";
import {
  buildChatDetailsParticipants,
  formatChatDetailsLocation,
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
    description: "Tomada queimada",
    photos: [],
    urgency: null,
    status: "open",
    scope_complexity: null,
    estimated_duration_hint: null,
    created_at: "2026-06-01T08:00:00Z",
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
  address: {
    neighborhood: "Centro",
    city: "Curitiba",
    state: "PR",
  },
  counterparty_read_receipt: null,
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

  it("formats masked address parts", () => {
    expect(formatChatDetailsLocation(baseDetail.address)).toBe("Centro, Curitiba, PR");
    expect(formatChatDetailsLocation({ neighborhood: null, city: "Curitiba", state: null })).toBe(
      "Curitiba",
    );
  });
});
