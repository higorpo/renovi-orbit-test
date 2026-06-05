// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { DynamicMessageRenderer } from "../DynamicMessageRenderer";

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

vi.mock("../DynamicProposalCard", () => ({
  DynamicProposalCard: () => <div data-testid="proposal-card" />,
}));

vi.mock("../ChatAudioMessage", () => ({
  ChatAudioMessage: () => <div data-testid="audio-message" />,
}));

const baseMessage: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u1",
  message_type: "TEXT",
  payload: { text: "Olá" },
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("DynamicMessageRenderer", () => {
  it("renders proposal card for PROPOSAL messages", () => {
    render(
      <DynamicMessageRenderer
        chatId="chat-1"
        message={{
          ...baseMessage,
          message_type: "PROPOSAL",
          linked_entity_type: "proposal",
          linked_entity_id: "p1",
        }}
        viewerRole="client"
        isOutgoing={false}
      />,
    );

    expect(screen.getByTestId("proposal-card")).toBeTruthy();
  });

  it("renders audio card for AUDIO messages", () => {
    render(
      <DynamicMessageRenderer
        chatId="chat-1"
        message={{
          ...baseMessage,
          message_type: "AUDIO",
          payload: { duration_ms: 30_000, path: "chat/session/voice.webm" },
        }}
        viewerRole="client"
        isOutgoing={true}
      />,
    );

    expect(screen.getByTestId("audio-message")).toBeTruthy();
  });

  it("renders fallback for unknown message types without crashing", () => {
    render(
      <DynamicMessageRenderer
        chatId="chat-1"
        message={{
          ...baseMessage,
          message_type: "TEXT",
          payload: { preview: "Algo novo" },
        }}
        viewerRole="client"
        isOutgoing={false}
      />,
    );

    expect(screen.getByText("Mensagem não suportada")).toBeTruthy();
  });
});
