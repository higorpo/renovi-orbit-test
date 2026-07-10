// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useServiceDetailChatNavigation } from "../useServiceDetailChatNavigation";

const { navigateMock, initiateConversationMock, toastErrorMock, onlineState } =
  vi.hoisted(() => ({
    navigateMock: vi.fn(),
    initiateConversationMock: vi.fn(),
    toastErrorMock: vi.fn(),
    onlineState: { isOnline: true },
  }));

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => onlineState.isOnline,
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock("@/features/chats", () => ({
  initiateConversation: initiateConversationMock,
  CHAT_CONVERSATIONS_LIST_QUERY_KEY: "chat-conversations",
  PROVIDER_SERVICE_CHAT_QUERY_KEY: "provider-service-chat",
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000005",
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  onlineState.isOnline = true;
});

describe("useServiceDetailChatNavigation", () => {
  it("navigates directly when chat already exists", async () => {
    const { result } = renderHook(
      () =>
        useServiceDetailChatNavigation({
          serviceRequestId: "sr-1",
          existingChatId: "chat-existing",
        }),
      { wrapper: createWrapper() },
    );

    result.current.openChat();

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-existing");
    });
    expect(initiateConversationMock).not.toHaveBeenCalled();
  });

  it("initiates conversation when chat does not exist", async () => {
    initiateConversationMock.mockResolvedValue({
      data: { conversation: { id: "chat-new" } },
      error: null,
    });

    const { result } = renderHook(
      () =>
        useServiceDetailChatNavigation({
          serviceRequestId: "sr-1",
          existingChatId: null,
        }),
      { wrapper: createWrapper() },
    );

    result.current.openChat();

    await waitFor(() => {
      expect(initiateConversationMock).toHaveBeenCalledWith({
        serviceRequestId: "sr-1",
        idempotencyKey: "00000000-0000-7000-8000-000000000005",
      });
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-new");
    });
  });

  it("shows offline toast when device is offline", async () => {
    onlineState.isOnline = false;

    const { result } = renderHook(
      () =>
        useServiceDetailChatNavigation({
          serviceRequestId: "sr-1",
          existingChatId: "chat-1",
        }),
      { wrapper: createWrapper() },
    );

    result.current.openChat();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Você está offline. Conecte-se à internet para abrir a conversa.",
      );
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows initiate fallback when conversation creation fails", async () => {
    initiateConversationMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useServiceDetailChatNavigation({
          serviceRequestId: "sr-1",
          existingChatId: null,
        }),
      { wrapper: createWrapper() },
    );

    result.current.openChat();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível iniciar a conversa.",
      );
    });
  });

  it("shows open fallback when existing chat navigation path fails", async () => {
    onlineState.isOnline = false;

    const { result } = renderHook(
      () =>
        useServiceDetailChatNavigation({
          serviceRequestId: "sr-1",
          existingChatId: "chat-1",
        }),
      { wrapper: createWrapper() },
    );

    result.current.openChat();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalled();
    });
  });
});
