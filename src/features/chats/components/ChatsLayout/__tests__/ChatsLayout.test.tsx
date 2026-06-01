// @vitest-environment happy-dom
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ChatsLayout } from "../ChatsLayout";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("../../ChatListPage/ChatListPage", () => ({
  ChatListPage: () => <div data-testid="chat-list">Lista</div>,
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
});
