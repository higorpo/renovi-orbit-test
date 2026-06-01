// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TYPING_ACTIVITY_IDLE_MS,
  TYPING_PRESENCE_PUBLISH_INTERVAL_MS,
} from "../../utils/typingPresence";
import { useConversationTypingPresence } from "../useConversationTypingPresence";

const channelMock = {
  on: vi.fn(function (this: typeof channelMock) {
    return channelMock;
  }),
  subscribe: vi.fn((cb: (status: string) => void) => {
    queueMicrotask(() => cb("SUBSCRIBED"));
    return channelMock;
  }),
  track: vi.fn(async () => "ok"),
  untrack: vi.fn(async () => "ok"),
  presenceState: vi.fn(() => ({
    "user-b": [{ user_id: "user-b", typing: true, at: Date.now() }],
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn() },
}));

describe("useConversationTypingPresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.presenceState.mockReturnValue({
      "user-b": [{ user_id: "user-b", typing: true, at: Date.now() }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows counterparty typing from presence sync", async () => {
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    await waitFor(() => expect(result.current.isCounterpartyTyping).toBe(true));
  });

  it("publishes typing true on composer change", async () => {
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    act(() => {
      result.current.notifyComposerChange();
    });

    await waitFor(() =>
      expect(channelMock.track).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-a",
          typing: true,
        }),
      ),
    );
  });

  it("publishes typing false after 2s without changes and true again on resume", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.notifyComposerChange();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-a", typing: true }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_ACTIVITY_IDLE_MS + 50);
    });

    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-a", typing: false }),
    );

    act(() => {
      result.current.notifyComposerChange();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(channelMock.track).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: "user-a", typing: true }),
    );
  });

  it("republishes typing true on keep-alive while the session is active", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.notifyComposerChange();
    });

    const trueCalls = () =>
      channelMock.track.mock.calls.filter((call) => call[0]?.typing === true).length;

    expect(trueCalls()).toBe(1);

    // Reset idle (also 2s) so it does not race with the keep-alive tick at 2s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_PRESENCE_PUBLISH_INTERVAL_MS - 1);
    });

    act(() => {
      result.current.notifyComposerChange();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(trueCalls()).toBeGreaterThanOrEqual(2);
  });

  it("publishes typing false immediately on notifyTypingStopNow", async () => {
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    act(() => {
      result.current.notifyComposerChange();
      result.current.notifyTypingStopNow();
    });

    await waitFor(() =>
      expect(channelMock.track).toHaveBeenLastCalledWith(
        expect.objectContaining({ user_id: "user-a", typing: false }),
      ),
    );
  });
});
