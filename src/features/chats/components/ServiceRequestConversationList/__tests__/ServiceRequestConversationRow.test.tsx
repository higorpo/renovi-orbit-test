// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConversationListItem } from "../../../types/chats.types";
import { ServiceRequestConversationRow } from "../ServiceRequestConversationRow";

vi.mock("@/features/provider-profile", () => ({
  usePublicProfileImageUrl: () => ({ url: null, isLoading: false }),
}));

const conversation: ConversationListItem = {
  id: "chat-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  status: "ACTIVE",
  last_interaction_at: "2026-05-30T12:00:00.000Z",
  activated_at: "2026-05-01T12:00:00.000Z",
  inactivated_at: null,
  closed_at: null,
  created_at: "2026-05-01T12:00:00.000Z",
  updated_at: "2026-05-30T12:00:00.000Z",
  counterparty: {
    id: "provider-1",
    full_name: "João Eletricista",
    profile_image_path: null,
    role: "provider",
  },
  service_request_title: "Instalação elétrica",
  service: {
    id: "svc-1",
    title: "Instalação elétrica",
    slug: "instalacao-eletrica",
    icon_key: "Zap",
    color_key: "yellow_orange",
    image_url: null,
  },
  last_message: {
    id: "msg-1",
    message_type: "TEXT",
    created_at: "2026-05-30T12:00:00.000Z",
    preview_text: "Olá, posso visitar amanhã?",
    linked_entity_type: null,
    linked_entity_id: null,
  },
  is_unread: true,
  last_read_at: null,
};

describe("ServiceRequestConversationRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders provider-focused row without service title and selects on click", () => {
    const onSelect = vi.fn();
    render(<ServiceRequestConversationRow item={conversation} onSelect={onSelect} />);

    expect(screen.getByText("João Eletricista")).toBeTruthy();
    expect(screen.getByText("Olá, posso visitar amanhã?")).toBeTruthy();
    expect(screen.getByText("JE")).toBeTruthy();
    expect(screen.getByLabelText("Mensagens não lidas")).toBeTruthy();
    expect(screen.queryByText("Instalação elétrica")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Conversa com João Eletricista/i }));
    expect(onSelect).toHaveBeenCalledWith("chat-1");
  });
});
