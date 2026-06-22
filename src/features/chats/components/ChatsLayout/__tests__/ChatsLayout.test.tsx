// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ChatsLayout } from "../ChatsLayout";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => useBreakpointMdMock(),
}));

const { useOnlineStatusMock, useBreakpointMdMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
  useBreakpointMdMock: vi.fn(() => true),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

vi.mock("../../ChatListPage/ChatListPage", () => ({
  ChatListPage: () => <div data-testid="chat-list">Lista</div>,
}));

vi.mock("../../../hooks/useInboxRealtime", () => ({
  useInboxRealtime: vi.fn(),
}));

vi.mock("../ChatScreen/ChatScreen", () => ({
  ChatScreen: () => <div data-testid="chat-screen" />,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chats" element={<ChatsLayout />}>
          <Route path=":chatId" element={<div data-testid="chat-screen" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatsLayout", () => {
  it("shows list empty state on desktop index route", () => {
    renderAt("/chats");
    expect(screen.getByTestId("chat-list")).toBeTruthy();
    expect(screen.getByText("Selecione uma conversa")).toBeTruthy();
  });

  it("uses fullscreen shell on mobile conversation route", () => {
    useBreakpointMdMock.mockReturnValue(false);
    useOnlineStatusMock.mockReturnValue(true);
    renderAt("/chats/chat-1");
    const shell = screen.getByTestId("chat-conversation-fullscreen");
    expect(shell.className).toContain("max-md:fixed");
    expect(shell.className).toContain("max-md:top-0");
    expect(shell.className).toContain("max-md:h-dvh");
  });

  it("offsets fullscreen shell below offline banner on mobile conversation route", () => {
    useBreakpointMdMock.mockReturnValue(false);
    useOnlineStatusMock.mockReturnValue(false);
    renderAt("/chats/chat-1");
    const shell = screen.getByTestId("chat-conversation-fullscreen");
    expect(shell.className).toContain("max-md:top-11");
    expect(shell.className).toContain("max-md:h-[calc(100dvh-2.75rem)]");
  });

  it("uses fixed desktop sidebar width on index route", () => {
    renderAt("/chats");
    const listPanel = screen.getByTestId("chat-list-panel");
    expect(listPanel.className).toContain("md:w-[360px]");
    expect(listPanel.className).toContain("md:flex-none");
    expect(listPanel.className).toContain("max-md:flex-1");
  });

  it("uses the same fixed desktop sidebar width when a chat is selected", () => {
    renderAt("/chats/chat-1");
    const listPanel = screen.getByTestId("chat-list-panel");
    expect(listPanel.className).toContain("md:w-[360px]");
    expect(listPanel.className).toContain("md:flex-none");
    expect(listPanel.className).not.toContain("max-md:flex-1");
  });
});
