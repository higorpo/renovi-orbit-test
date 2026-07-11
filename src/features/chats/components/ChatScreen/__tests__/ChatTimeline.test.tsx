// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../../types/chats.types";
import { ChatTimeline } from "../ChatTimeline";

const scrollRef = { current: null as HTMLDivElement | null };
const onTimelineScrollMock = vi.fn();
const onLoadOlderMock = vi.fn();
const onRetryMock = vi.fn();

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => false,
}));

vi.mock("../../../hooks/useChatTimelineScroll", () => ({
  useChatTimelineScroll: () => ({
    scrollRef,
    bottomRef: { current: null },
    preserveScrollOnLayoutShift: vi.fn(),
    onComposerFocus: vi.fn(),
    onTimelineScroll: onTimelineScrollMock,
  }),
}));

vi.mock("../../../hooks/useChatTimelinePrependScroll", () => ({
  useChatTimelinePrependScroll: vi.fn(),
}));

vi.mock("../ChatMessageRow", () => ({
  ChatMessageRow: ({
    message,
    showReadReceipt,
  }: {
    message: ChatMessageListItem;
    showReadReceipt: boolean;
  }) => (
    <div data-testid={`message-${message.id}`}>
      {String(message.payload.text ?? message.message_type)}
      {showReadReceipt ? <span>Visualizado</span> : null}
    </div>
  ),
}));

vi.mock("../ChatDiscoveryWelcome", () => ({
  ChatDiscoveryWelcome: ({ viewerRole }: { viewerRole: string }) => (
    <section aria-label={`welcome-${viewerRole}`}>Welcome</section>
  ),
}));

vi.mock("../ChatTimelineSkeleton", () => ({
  ChatTimelineSkeleton: () => <div data-testid="timeline-skeleton">Loading</div>,
}));

function buildMessage(
  partial: Pick<ChatMessageListItem, "id" | "sender_user_id" | "created_at"> & {
    text?: string;
  },
): ChatMessageListItem {
  return {
    id: partial.id,
    chat_id: "chat-1",
    sender_user_id: partial.sender_user_id,
    message_type: "TEXT",
    payload: { text: partial.text ?? `msg-${partial.id}` },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: `k-${partial.id}`,
    delivery_status: "SENT",
    created_at: partial.created_at,
    updated_at: partial.created_at,
  };
}

const defaultProps = {
  chatId: "chat-1",
  messages: [] as ChatMessageListItem[],
  currentUserId: "user-1",
  counterpartyName: "João",
  viewerRole: "client" as const,
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  conversationCreatedAt: "2026-06-01T09:00:00.000Z",
  onLoadOlder: onLoadOlderMock,
  onRetry: onRetryMock,
};

describe("ChatTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scrollRef.current = null;
  });

  it("shows skeleton while messages are loading", () => {
    render(<ChatTimeline {...defaultProps} isLoading />);
    expect(screen.getByTestId("timeline-skeleton")).toBeInTheDocument();
  });

  it("shows error state with retry when loading fails", () => {
    render(
      <ChatTimeline
        {...defaultProps}
        isError
        errorMessage="Falha ao carregar mensagens"
      />,
    );

    expect(screen.getByText("Falha ao carregar mensagens")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it("shows fallback error copy when no errorMessage is provided", () => {
    render(<ChatTimeline {...defaultProps} isError onRetry={undefined} />);

    expect(
      screen.getByText("Não foi possível carregar as mensagens."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  });

  it("renders discovery welcome and messages when history is fully loaded", () => {
    const messages = [
      buildMessage({
        id: "m1",
        sender_user_id: "user-2",
        created_at: "2026-06-01T10:00:00.000Z",
        text: "Oi",
      }),
      buildMessage({
        id: "m2",
        sender_user_id: "user-1",
        created_at: "2026-06-01T10:01:00.000Z",
        text: "Olá",
      }),
    ];

    render(
      <ChatTimeline
        {...defaultProps}
        messages={messages}
        viewedReceiptMessageId="m2"
      />,
    );

    expect(screen.getByLabelText("Mensagens da conversa")).toBeInTheDocument();
    expect(screen.getByLabelText("welcome-client")).toBeInTheDocument();
    expect(screen.getByTestId("message-m1")).toHaveTextContent("Oi");
    expect(screen.getByTestId("message-m2")).toHaveTextContent("Olá");
    expect(screen.getByTestId("message-m2")).toHaveTextContent("Visualizado");
  });

  it("hides discovery welcome while older pages are still available", () => {
    render(
      <ChatTimeline
        {...defaultProps}
        hasNextPage
        messages={[
          buildMessage({
            id: "m1",
            sender_user_id: "user-2",
            created_at: "2026-06-01T10:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.queryByLabelText("welcome-client")).toBeNull();
    expect(screen.getByTestId("message-m1")).toBeInTheDocument();
  });

  it("shows older-messages loading indicator while fetching next page", () => {
    render(
      <ChatTimeline
        {...defaultProps}
        isFetchingNextPage
        hasNextPage
        messages={[
          buildMessage({
            id: "m1",
            sender_user_id: "user-2",
            created_at: "2026-06-01T10:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Carregando mensagens anteriores…")).toBeInTheDocument();
  });

  it("loads older messages when scrolled near the top", () => {
    const { container } = render(
      <ChatTimeline
        {...defaultProps}
        hasNextPage
        messages={[
          buildMessage({
            id: "m1",
            sender_user_id: "user-2",
            created_at: "2026-06-01T10:00:00.000Z",
          }),
        ]}
      />,
    );

    const scroller = screen.getByLabelText("Mensagens da conversa");
    scrollRef.current = scroller as HTMLDivElement;
    Object.defineProperty(scroller, "scrollTop", { value: 10, configurable: true });

    fireEvent.scroll(scroller);

    expect(onTimelineScrollMock).toHaveBeenCalled();
    expect(onLoadOlderMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[aria-label='Mensagens da conversa']")).toBeTruthy();
  });

  it("does not load older messages when already fetching or far from top", () => {
    render(
      <ChatTimeline
        {...defaultProps}
        hasNextPage
        isFetchingNextPage
        messages={[
          buildMessage({
            id: "m1",
            sender_user_id: "user-2",
            created_at: "2026-06-01T10:00:00.000Z",
          }),
        ]}
      />,
    );

    const scroller = screen.getByLabelText("Mensagens da conversa");
    scrollRef.current = scroller as HTMLDivElement;
    Object.defineProperty(scroller, "scrollTop", { value: 10, configurable: true });
    fireEvent.scroll(scroller);
    expect(onLoadOlderMock).not.toHaveBeenCalled();

    Object.defineProperty(scroller, "scrollTop", { value: 120, configurable: true });
    // Flip fetching off but keep scroll far from top
    render(
      <ChatTimeline
        {...defaultProps}
        hasNextPage
        isFetchingNextPage={false}
        messages={[
          buildMessage({
            id: "m1",
            sender_user_id: "user-2",
            created_at: "2026-06-01T10:00:00.000Z",
          }),
        ]}
      />,
    );
  });

  it("applies top padding when action banner inset is set", () => {
    render(<ChatTimeline {...defaultProps} actionBannerTopInset={64} />);

    const scroller = screen.getByLabelText("Mensagens da conversa");
    expect(scroller.style.paddingTop).toBe("64px");
    expect(scroller.style.scrollPaddingTop).toBe("64px");
  });
});
