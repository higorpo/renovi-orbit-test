// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationListItem } from "../../../types/chats.types";
import { ChatListItem } from "../ChatListItem";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    Icon: () => <span data-testid="service-icon" />,
    color: "from-slate-500 to-slate-600",
  }),
}));

const baseItem: ConversationListItem = {
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
    id: "user-2",
    full_name: "Maria Santos",
    profile_image_path: null,
    role: "provider",
  },
  service_request_title: "Pintura da sala",
  service: {
    id: "svc-1",
    title: "Pintura",
    slug: "pintura",
    icon_key: "Paintbrush",
    color_key: "blue",
    image_url: null,
  },
  last_message: {
    id: "msg-1",
    message_type: "TEXT",
    created_at: "2026-05-30T12:00:00.000Z",
    preview_text: "Podemos combinar a visita amanhã?",
    linked_entity_type: null,
    linked_entity_id: null,
  },
  is_unread: true,
  last_read_at: null,
};

describe("ChatListItem", () => {
  it("renders counterparty, service title, preview and unread indicator", () => {
    render(<ChatListItem item={baseItem} onSelect={vi.fn()} />);

    expect(screen.getByText("Maria Santos")).toBeTruthy();
    expect(screen.getByText("Pintura da sala")).toBeTruthy();
    expect(screen.getByText("Podemos combinar a visita amanhã?")).toBeTruthy();
    expect(screen.getByLabelText("Mensagens não lidas")).toBeTruthy();
  });

  it("calls onSelect when activated", () => {
    const onSelect = vi.fn();
    render(<ChatListItem item={baseItem} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Conversa com Maria Santos/i }));
    expect(onSelect).toHaveBeenCalledWith("chat-1");
  });

  it("shows status badge for INACTIVE conversations", () => {
    render(
      <ChatListItem
        item={{ ...baseItem, status: "INACTIVE", is_unread: false }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Inativa")).toBeTruthy();
  });

  it("shows fallback preview when there is no last message", () => {
    render(
      <ChatListItem
        item={{ ...baseItem, last_message: null, is_unread: false }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Sem mensagens ainda")).toBeTruthy();
  });
});
