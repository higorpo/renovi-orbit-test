// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ChatListPage } from "../ChatListPage";

vi.mock("../../../hooks/useChatConversations", () => ({
  useChatConversations: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/features/auth";
import { useChatConversations } from "../../../hooks/useChatConversations";

const useAuthMock = vi.mocked(useAuth);
const useChatConversationsMock = vi.mocked(useChatConversations);

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
});
