// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { ChatMessageRow } from "../ChatMessageRow";

vi.mock("../../DynamicMessageRenderer/DynamicMessageRenderer", () => ({
  DynamicMessageRenderer: ({
    message,
  }: {
    message: ChatMessageListItem;
  }) => <div data-testid="dynamic-renderer">{message.message_type}</div>,
}));

vi.mock("@/features/service-reschedule", () => ({
  isServiceRescheduleProposedWorkflowMessage: (message: ChatMessageListItem) =>
    message.message_type === "WORKFLOW" &&
    Boolean(
      message.payload &&
        typeof message.payload === "object" &&
        "event" in message.payload &&
        message.payload.event === "service_reschedule.proposed",
    ),
}));

function buildMessage(
  overrides: Partial<ChatMessageListItem> & Pick<ChatMessageListItem, "message_type">,
): ChatMessageListItem {
  return {
    id: "m1",
    chat_id: "chat-1",
    sender_user_id: "user-2",
    payload: { text: "Oi" },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: "k1",
    delivery_status: "SENT",
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

const baseProps = {
  chatId: "chat-1",
  groupPosition: "single" as const,
  showIncomingAvatar: true,
  showGroupTimestamp: true,
  showReadReceipt: false,
  isOutgoing: false,
  counterpartyName: "João Prestador",
  viewerRole: "client" as const,
};

describe("ChatMessageRow", () => {
  it("renders text bubble with avatar and timestamp for incoming text", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        message={buildMessage({ message_type: "TEXT", payload: { text: "Olá" } })}
      />,
    );

    expect(screen.getByText("Olá")).toBeInTheDocument();
    expect(screen.getByText("JP")).toBeInTheDocument();
    expect(screen.getByLabelText(/visualizado|:/i)).toBeTruthy();
  });

  it("shows read receipt for outgoing text without avatar", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        isOutgoing
        showIncomingAvatar={false}
        showReadReceipt
        message={buildMessage({
          message_type: "TEXT",
          sender_user_id: "user-1",
          payload: { text: "Enviado" },
        })}
      />,
    );

    expect(screen.getByText("Enviado")).toBeInTheDocument();
    expect(screen.getByText(/Visualizado/)).toBeInTheDocument();
    expect(screen.queryByText("JP")).toBeNull();
  });

  it("delegates image messages to the dynamic renderer", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        message={buildMessage({
          message_type: "IMAGE",
          payload: { paths: ["a.png"] },
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("IMAGE");
  });

  it("renders interactive proposal cards with avatar gutter", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        message={buildMessage({
          message_type: "PROPOSAL",
          linked_entity_id: "p1",
          payload: { proposal_id: "p1" },
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("PROPOSAL");
    expect(screen.getByText("JP")).toBeInTheDocument();
  });

  it("renders reschedule workflow cards as interactive rows", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        isOutgoing
        message={buildMessage({
          message_type: "WORKFLOW",
          sender_user_id: "user-1",
          payload: { event: "service_reschedule.proposed" },
          linked_entity_id: "req-1",
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("WORKFLOW");
  });

  it("renders non-interactive system messages without avatar gutter", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        message={buildMessage({
          message_type: "SYSTEM",
          payload: { text: "Sistema" },
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("SYSTEM");
    expect(screen.queryByText("JP")).toBeNull();
  });

  it("right-aligns outgoing non-interactive system messages", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        isOutgoing
        message={buildMessage({
          message_type: "SYSTEM",
          sender_user_id: "user-1",
          payload: { text: "Sistema" },
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer").parentElement).toHaveClass("justify-end");
  });

  it("renders incoming interactive cards without initials when the avatar is hidden", () => {
    render(
      <ChatMessageRow
        {...baseProps}
        showIncomingAvatar={false}
        message={buildMessage({
          message_type: "PROPOSAL",
          payload: { proposal_id: "p1" },
        })}
      />,
    );

    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("PROPOSAL");
    expect(screen.queryByText("JP")).toBeNull();
  });

  it("renders outgoing interactive cards and audio rows without incoming gutters", () => {
    const { rerender } = render(
      <ChatMessageRow
        {...baseProps}
        isOutgoing
        message={buildMessage({
          message_type: "PROPOSAL",
          sender_user_id: "user-1",
        })}
      />,
    );
    expect(screen.queryByText("JP")).toBeNull();

    rerender(
      <ChatMessageRow
        {...baseProps}
        groupPosition="middle"
        showGroupTimestamp={false}
        message={buildMessage({ message_type: "AUDIO", payload: { path: "voice.webm" } })}
      />,
    );
    expect(screen.getByTestId("dynamic-renderer")).toHaveTextContent("AUDIO");
    expect(screen.queryByLabelText(/visualizado|:/i)).toBeNull();
  });

  it("evaluates every memo comparison prop when rerendering", () => {
    const message = buildMessage({ message_type: "TEXT", payload: { text: "Memo" } });
    const onProposalAction = vi.fn();
    const onRescheduleAction = vi.fn();
    const props = {
      ...baseProps,
      message,
      onProposalAction,
      onRescheduleAction,
    };
    const { rerender } = render(<ChatMessageRow {...props} />);

    const variants = [
      { chatId: "chat-2" },
      { isOutgoing: true },
      { groupPosition: "first" as const },
      { showIncomingAvatar: false },
      { showGroupTimestamp: false },
      { showReadReceipt: true },
      { counterpartyName: "Maria Cliente" },
      { viewerRole: "provider" as const },
      { onProposalAction: vi.fn() },
      { onRescheduleAction: vi.fn() },
      { message: { ...message, updated_at: "2026-06-01T11:00:00.000Z" } },
    ];

    for (const variant of variants) {
      rerender(<ChatMessageRow {...props} {...variant} />);
      rerender(<ChatMessageRow {...props} />);
    }

    rerender(<ChatMessageRow {...props} />);
    expect(screen.getByText("Memo")).toBeInTheDocument();
  });
});
