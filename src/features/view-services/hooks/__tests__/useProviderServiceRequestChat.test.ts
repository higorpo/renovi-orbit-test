// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useProviderServiceRequestChat } from "../useProviderServiceRequestChat";

const authMocks = vi.hoisted(() => ({
  profile: { role: "provider" as "provider" | "client" | undefined },
}));

const findChatMock = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/features/chats", () => ({
  findProviderChatForServiceRequest: (...args: unknown[]) => findChatMock(...args),
  PROVIDER_SERVICE_CHAT_QUERY_KEY: "provider-service-chat",
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
  authMocks.profile = { role: "provider" };
});

describe("useProviderServiceRequestChat", () => {
  it("is disabled for clients or missing ids", () => {
    authMocks.profile = { role: "client" };
    const { result } = renderHook(() => useProviderServiceRequestChat("sr-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(findChatMock).not.toHaveBeenCalled();
  });

  it("loads chat for providers", async () => {
    findChatMock.mockResolvedValue({
      data: { id: "chat-1" },
      error: null,
    });

    const { result } = renderHook(() => useProviderServiceRequestChat("sr-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "chat-1" });
  });

  it("throws when chat lookup fails", async () => {
    findChatMock.mockResolvedValue({
      data: null,
      error: new Error("denied"),
    });

    const { result } = renderHook(() => useProviderServiceRequestChat("sr-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
