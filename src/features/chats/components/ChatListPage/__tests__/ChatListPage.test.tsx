// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConversationListItem } from "../../../types/chats.types";
import { ChatListPage } from "../ChatListPage";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ search: "?from=list", pathname: "/dashboard/chats" }),
  };
});

vi.mock("../../../hooks/useChatConversations", () => ({
  useChatConversations: vi.fn(),
}));

vi.mock("../../../hooks/useChatListServiceRequestFilter", () => ({
  useChatListServiceRequestFilter: vi.fn(),
}));

vi.mock("../ChatListServiceRequestFilterBanner", () => ({
  ChatListServiceRequestFilterBanner: () => <div data-testid="service-request-filter-banner" />,
}));

vi.mock("../../ChatListItem/ChatListItem", () => ({
  ChatListItem: ({
    item,
    isActive,
    onSelect,
  }: {
    item: ConversationListItem;
    isActive?: boolean;
    onSelect: (id: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`chat-item-${item.id}`}
      data-active={isActive ? "true" : "false"}
      onClick={() => onSelect(item.id)}
    >
      {item.counterparty.full_name}
    </button>
  ),
}));

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/features/auth";
import { useChatConversations } from "../../../hooks/useChatConversations";
import { useChatListServiceRequestFilter } from "../../../hooks/useChatListServiceRequestFilter";

const useAuthMock = vi.mocked(useAuth);
const useChatConversationsMock = vi.mocked(useChatConversations);
const useChatListServiceRequestFilterMock = vi.mocked(useChatListServiceRequestFilter);

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
  last_message: null,
  is_unread: false,
  last_read_at: null,
};

const defaultConversationsState = {
  conversations: [] as ConversationListItem[],
  isLoading: false,
  isError: false,
  error: null as Error | null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
};

function renderPage(props?: React.ComponentProps<typeof ChatListPage>) {
  return render(
    <MemoryRouter>
      <ChatListPage {...props} />
    </MemoryRouter>,
  );
}

describe("ChatListPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useAuthMock.mockReturnValue({
      profile: { role: "client" },
    } as ReturnType<typeof useAuth>);
    useChatListServiceRequestFilterMock.mockReturnValue({
      serviceRequestId: null,
      clearFilter: vi.fn(),
    });
  });

  it("shows provider-oriented subtitle", () => {
    useAuthMock.mockReturnValue({
      profile: { role: "provider" },
    } as ReturnType<typeof useAuth>);
    useChatConversationsMock.mockReturnValue(defaultConversationsState);

    renderPage();
    expect(screen.getByText("Suas negociações com clientes")).toBeTruthy();
  });

  it("shows client-oriented subtitle", () => {
    useAuthMock.mockReturnValue({
      profile: { role: "client" },
    } as ReturnType<typeof useAuth>);
    useChatConversationsMock.mockReturnValue(defaultConversationsState);

    renderPage();
    expect(screen.getByText("Suas negociações com prestadores")).toBeTruthy();
  });

  it("shows skeleton while loading", () => {
    useChatConversationsMock.mockReturnValue({
      conversations: [],
      isLoading: true,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByLabelText("Carregando conversas")).toBeTruthy();
  });

  it("shows empty state when there are no conversations", () => {
    useChatConversationsMock.mockReturnValue({
      conversations: [],
      isLoading: false,
      isError: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByText("Nenhuma conversa ainda")).toBeTruthy();
  });

  it("shows filtered empty state when service request filter is active", () => {
    useChatListServiceRequestFilterMock.mockReturnValue({
      serviceRequestId: "sr-1",
      clearFilter: vi.fn(),
    });
    useChatConversationsMock.mockReturnValue(defaultConversationsState);

    renderPage();
    expect(screen.getByText("Nenhuma conversa para este pedido")).toBeTruthy();
    expect(useChatConversationsMock).toHaveBeenCalledWith({ serviceRequestId: "sr-1" });
  });

  it("shows error message and retries on refetch", () => {
    const refetch = vi.fn();
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      isError: true,
      error: new Error("Falha de rede"),
      refetch,
    });

    renderPage();
    expect(screen.getByText("Falha de rede")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows generic error when error is not an Error instance", () => {
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      isError: true,
      error: "boom" as unknown as Error,
    });

    renderPage();
    expect(screen.getByText("Não foi possível carregar as conversas.")).toBeTruthy();
  });

  it("renders conversations and navigates on select by default", () => {
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      conversations: [conversation],
    });

    renderPage({ selectedChatId: "chat-1" });
    expect(screen.getByTestId("chat-item-chat-1")).toHaveAttribute(
      "data-active",
      "true",
    );
    fireEvent.click(screen.getByTestId("chat-item-chat-1"));
    expect(navigateMock).toHaveBeenCalledWith(
      "/dashboard/chats/chat-1?from=list",
    );
  });

  it("uses onSelectConversation callback when provided", () => {
    const onSelectConversation = vi.fn();
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      conversations: [conversation],
    });

    renderPage({ onSelectConversation });
    fireEvent.click(screen.getByTestId("chat-item-chat-1"));
    expect(onSelectConversation).toHaveBeenCalledWith("chat-1");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("loads next page when Carregar mais is clicked", () => {
    const fetchNextPage = vi.fn();
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      conversations: [conversation],
      hasNextPage: true,
      fetchNextPage,
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("disables load-more button while fetching next page", () => {
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      conversations: [conversation],
      hasNextPage: true,
      isFetchingNextPage: true,
    });

    renderPage();
    expect(screen.getByRole("button", { name: /Carregando/i })).toBeDisabled();
  });

  it("renders service request filter banner when filter is set", () => {
    useChatListServiceRequestFilterMock.mockReturnValue({
      serviceRequestId: "sr-1",
      clearFilter: vi.fn(),
    });
    useChatConversationsMock.mockReturnValue({
      ...defaultConversationsState,
      conversations: [conversation],
    });

    renderPage();
    expect(screen.getByTestId("service-request-filter-banner")).toBeTruthy();
  });

  it("applies custom className on the section", () => {
    useChatConversationsMock.mockReturnValue(defaultConversationsState);
    renderPage({ className: "custom-chat-list" });
    expect(screen.getByLabelText("Lista de conversas")).toHaveClass(
      "custom-chat-list",
    );
  });

  it("falls back to client subtitle when profile role is missing", () => {
    useAuthMock.mockReturnValue({
      profile: null,
    } as ReturnType<typeof useAuth>);
    useChatConversationsMock.mockReturnValue(defaultConversationsState);

    renderPage();
    expect(screen.getByText("Suas negociações com prestadores")).toBeTruthy();
  });
});
