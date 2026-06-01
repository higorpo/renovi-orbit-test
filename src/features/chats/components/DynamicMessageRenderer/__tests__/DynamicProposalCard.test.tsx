// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { DynamicProposalCard } from "../DynamicProposalCard";

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

const hydrateMock = vi.fn();

vi.mock("../../../hooks/useProposalTimelineHydration", () => ({
  useProposalTimelineHydration: (...args: unknown[]) => hydrateMock(...args),
}));

const message: ChatMessageListItem = {
  id: "m1",
  chat_id: "c1",
  sender_user_id: "u2",
  message_type: "PROPOSAL",
  payload: { proposal_id: "p1", version: 1 },
  linked_entity_type: "proposal",
  linked_entity_id: "p1",
  idempotency_key: "k1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("DynamicProposalCard", () => {
  it("lazy-loads proposal details only after expand", () => {
    hydrateMock.mockReturnValue({
      proposal: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <DynamicProposalCard chatId="chat-1" message={message} viewerRole="client" isOutgoing={false} />,
    );

    expect(hydrateMock).toHaveBeenCalledWith("chat-1", "p1", false);

    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    expect(hydrateMock).toHaveBeenLastCalledWith("chat-1", "p1", true);
  });
});
