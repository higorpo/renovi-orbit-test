// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_ACTIVE_RESCHEDULE_QUERY_KEY,
  CHAT_RESCHEDULE_TIMELINE_QUERY_KEY,
  SERVICE_RESCHEDULE_REQUEST_QUERY_KEY,
} from "@/features/service-reschedule";
import { useInvalidateChatRescheduleQueries } from "../useInvalidateChatRescheduleQueries";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useInvalidateChatRescheduleQueries", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("invalidates reschedule hydration caches for the conversation", () => {
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateChatRescheduleQueries("chat-1"), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current();
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, "chat-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, "chat-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY],
    });
  });

  it("does nothing without a conversation id", () => {
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useInvalidateChatRescheduleQueries(null), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current();
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
