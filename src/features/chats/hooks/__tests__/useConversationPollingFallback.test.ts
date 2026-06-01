// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_POLLING_FALLBACK_INTERVAL_MS,
  useConversationPollingFallback,
} from "../useConversationPollingFallback";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useConversationPollingFallback", () => {
  it("does not poll when realtime is healthy", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useConversationPollingFallback({
        chatId: "chat-1",
        realtimeHealthy: true,
        onPoll,
      }),
    );

    vi.advanceTimersByTime(CHAT_POLLING_FALLBACK_INTERVAL_MS * 2);
    expect(onPoll).not.toHaveBeenCalled();
  });

  it("polls every 15s when realtime is down", () => {
    const onPoll = vi.fn();
    renderHook(() =>
      useConversationPollingFallback({
        chatId: "chat-1",
        realtimeHealthy: false,
        onPoll,
      }),
    );

    expect(onPoll).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(CHAT_POLLING_FALLBACK_INTERVAL_MS);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it("stops polling when realtime reconnects", () => {
    const onPoll = vi.fn();
    const { rerender } = renderHook(
      ({ healthy }: { healthy: boolean }) =>
        useConversationPollingFallback({
          chatId: "chat-1",
          realtimeHealthy: healthy,
          onPoll,
        }),
      { initialProps: { healthy: false } },
    );

    vi.advanceTimersByTime(CHAT_POLLING_FALLBACK_INTERVAL_MS);
    expect(onPoll).toHaveBeenCalledTimes(2);

    rerender({ healthy: true });
    vi.advanceTimersByTime(CHAT_POLLING_FALLBACK_INTERVAL_MS * 2);
    expect(onPoll).toHaveBeenCalledTimes(2);
  });
});
