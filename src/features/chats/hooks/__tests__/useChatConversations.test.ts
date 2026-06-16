// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatConversations } from "../useChatConversations";

const listConversationsMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  listConversations: (...args: unknown[]) => listConversationsMock(...args),
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
  listConversationsMock.mockResolvedValue({
    data: {
      items: [
        {
          id: "chat-1",
          service_request_id: "sr-1",
          client_id: "c1",
          provider_id: "p1",
          status: "ACTIVE",
          last_interaction_at: "2026-05-30T12:00:00.000Z",
          activated_at: null,
          inactivated_at: null,
          closed_at: null,
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-30T12:00:00.000Z",
          counterparty: {
            id: "u2",
            full_name: "Ana",
            profile_image_path: null,
            role: "provider",
          },
          service_request_title: "Serviço",
          service: {
            id: "s1",
            title: "Pintura",
            slug: "pintura",
            icon_key: null,
            color_key: null,
            image_url: null,
          },
          last_message: null,
          is_unread: false,
          last_read_at: null,
        },
      ],
      has_more: false,
      next_cursor: null,
    },
    error: null,
  });
});

describe("useChatConversations", () => {
  it("loads flattened conversations from listConversations", async () => {
    const { result } = renderHook(() => useChatConversations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0]?.id).toBe("chat-1");
    expect(listConversationsMock).toHaveBeenCalledWith({
      pageSize: 20,
      cursor: null,
      serviceRequestId: null,
    });
  });

  it("forwards service request filter to listConversations", async () => {
    const { result } = renderHook(
      () => useChatConversations({ serviceRequestId: "sr-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listConversationsMock).toHaveBeenCalledWith({
      pageSize: 20,
      cursor: null,
      serviceRequestId: "sr-1",
    });
  });
});
