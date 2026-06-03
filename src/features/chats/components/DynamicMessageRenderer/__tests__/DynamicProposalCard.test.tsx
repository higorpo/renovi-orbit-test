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
  it("hydrates proposal summary and opens details via callback", () => {
    hydrateMock.mockReturnValue({
      proposal: {
        status: "PENDING",
        proposed_amount: 500,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const onProposalAction = vi.fn();

    render(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={onProposalAction}
      />,
    );

    expect(hydrateMock).toHaveBeenCalledWith("chat-1", "p1", true);
    expect(screen.getByText("R$ 500,00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ver detalhes/i }));
    expect(onProposalAction).toHaveBeenCalledWith("view_details", "p1");
  });

  it("emits reject action when client taps Recusar", () => {
    hydrateMock.mockReturnValue({
      proposal: { status: "PENDING", proposed_amount: 500 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const onProposalAction = vi.fn();

    render(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={onProposalAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Recusar$/i }));
    expect(onProposalAction).toHaveBeenCalledWith("reject", "p1");
  });

  it("shows shimmer skeleton while proposal data is loading", () => {
    hydrateMock.mockReturnValue({
      proposal: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="client"
        isOutgoing={false}
        onProposalAction={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Carregando proposta")).toBeInTheDocument();
    expect(screen.queryByText("Proposta enviada")).not.toBeInTheDocument();
  });

  it("shows revision details label for provider when revision was requested", () => {
    hydrateMock.mockReturnValue({
      proposal: { status: "REVISION_REQUESTED", proposed_amount: 500 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <DynamicProposalCard
        chatId="chat-1"
        message={message}
        viewerRole="provider"
        isOutgoing
        onProposalAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Ver detalhes da revisão solicitada/i }),
    ).toBeInTheDocument();
  });
});
