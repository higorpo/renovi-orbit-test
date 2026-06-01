// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ChatListPage } from "../ChatListPage";

vi.mock("../../../hooks/useChatConversations", () => ({
  useChatConversations: vi.fn(),
}));

import { useChatConversations } from "../../../hooks/useChatConversations";

const useChatConversationsMock = vi.mocked(useChatConversations);

function renderPage() {
  return render(
    <MemoryRouter>
      <ChatListPage />
    </MemoryRouter>,
  );
}

describe("ChatListPage", () => {
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
