// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatComposerState } from "../useChatComposerState";

const checkFreeMessagingMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  checkChatFreeMessagingAllowed: (...args: unknown[]) => checkFreeMessagingMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useChatComposerState", () => {
  it("fetches free messaging gate and enables composer when allowed", async () => {
    checkFreeMessagingMock.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(
      () =>
        useChatComposerState({
          chatId: "chat-1",
          conversationStatus: "ACTIVE",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isInputEnabled).toBe(true));
    expect(checkFreeMessagingMock).toHaveBeenCalledWith("chat-1");
  });

  it("disables composer when PENDING blocks free messaging (client copy by default)", async () => {
    checkFreeMessagingMock.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(
      () =>
        useChatComposerState({
          chatId: "chat-1",
          conversationStatus: "ACTIVE",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.disabledReason).toBe("pending_proposal"));
    expect(result.current.isInputEnabled).toBe(false);
    expect(result.current.helperText).toContain("aceitar, pedir revisão ou recusar");
  });

  it("shows provider copy when PENDING blocks free messaging", async () => {
    checkFreeMessagingMock.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(
      () =>
        useChatComposerState({
          chatId: "chat-1",
          conversationStatus: "ACTIVE",
          viewerRole: "provider",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.disabledReason).toBe("pending_proposal"));
    expect(result.current.helperText).toContain("Aguarde a resposta do cliente");
  });
});
