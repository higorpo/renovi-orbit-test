// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChatListPage } from "../ChatListPage";

vi.mock("../../../hooks/useChatConversations", () => ({
  useChatConversations: vi.fn(),
}));

vi.mock("../../../hooks/useChatListServiceRequestFilter", () => ({
  useChatListServiceRequestFilter: vi.fn(),
}));

vi.mock("../ChatListServiceRequestFilterBanner", () => ({
  ChatListServiceRequestFilterBanner: () => <div data-testid="service-request-filter-banner" />,
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

const defaultConversationsState = {
  conversations: [],
  isLoading: false,
  isError: false,
  error: null,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatListPage />
    </MemoryRouter>,
  );
}

describe("ChatListPage", () => {
  beforeEach(() => {
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
});
