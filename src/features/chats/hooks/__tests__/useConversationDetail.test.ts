// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationDetail } from "../useConversationDetail";

const getConversationDetailMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  getConversationDetail: (...args: unknown[]) => getConversationDetailMock(...args),
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
  getConversationDetailMock.mockResolvedValue({
    data: {
      conversation: {
        id: "chat-1",
        service_request_id: "sr-1",
        client_id: "client-1",
        provider_id: "provider-1",
        status: "ACTIVE",
        last_interaction_at: "2026-05-30T12:00:00.000Z",
        activated_at: null,
        inactivated_at: null,
        inactivation_reason: null,
        closed_at: null,
        closure_type: null,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-30T12:00:00.000Z",
      },
      counterparty: {
        id: "provider-1",
        full_name: "Prestador",
        profile_image_path: null,
        role: "provider",
      },
      service_request: {
        id: "sr-1",
        title: "Pintura",
      },
      service: {
        id: "svc-1",
        title: "Pintura",
        slug: "pintura",
        icon_key: null,
        color_key: null,
        image_url: null,
      },
      category: null,
      counterparty_read_receipt: null,
      accepted_proposal: null,
    },
    error: null,
  });
});

describe("useConversationDetail", () => {
  it("loads conversation detail for chat id", async () => {
    const { result } = renderHook(() => useConversationDetail("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getConversationDetailMock).toHaveBeenCalledWith("chat-1");
    expect(result.current.detail?.conversation.id).toBe("chat-1");
    expect(result.current.detail?.conversation.status).toBe("ACTIVE");
  });

  it("does not fetch when chat id is null", () => {
    const { result } = renderHook(() => useConversationDetail(null), {
      wrapper: createWrapper(),
    });

    expect(getConversationDetailMock).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
  });
});
