import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobChatNavigation } from "../useProviderJobChatNavigation";

const { initiateConversationMock, toastErrorMock } = vi.hoisted(() => ({
  initiateConversationMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/features/chats", () => ({
  initiateConversation: (...args: unknown[]) => initiateConversationMock(...args),
  CHAT_CONVERSATIONS_LIST_QUERY_KEY: "chat-conversations",
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

function createWrapper(initialEntries = ["/dashboard/jobs/job-1"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProviderJobChatNavigation", () => {
  it("calls initiateConversation with service request id", async () => {
    initiateConversationMock.mockResolvedValue({
      data: {
        conversation: {
          id: "chat-42",
          service_request_id: "sr-1",
          client_id: "client-1",
          provider_id: "provider-1",
          status: "ACTIVE",
          last_interaction_at: "2026-01-01T00:00:00Z",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderJobChatNavigation("sr-1"), {
      wrapper: createWrapper(),
    });

    result.current.openChat();

    await waitFor(() =>
      expect(initiateConversationMock).toHaveBeenCalledWith({ serviceRequestId: "sr-1" }),
    );
    await waitFor(() => expect(result.current.isOpeningChat).toBe(false));
  });

  it("shows toast when initiation fails", async () => {
    initiateConversationMock.mockResolvedValue({
      data: null,
      error: { code: "NO_ACTIVE_SLOT", message: "Limite de conversas ativas atingido para este pedido." },
    });

    const { result } = renderHook(() => useProviderJobChatNavigation("sr-1"), {
      wrapper: createWrapper(),
    });

    result.current.openChat();

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Limite de conversas ativas atingido para este pedido.",
      ),
    );
  });
});
