// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TYPING_ACTIVITY_IDLE_MS,
  TYPING_PRESENCE_PUBLISH_INTERVAL_MS,
  TYPING_PRESENCE_TTL_MS,
} from "../../utils/typingPresence";
import { useConversationTypingPresence } from "../useConversationTypingPresence";

let subscribeCallback: ((status: string) => void) | null = null;
const presenceCallbacks = new Map<string, () => void>();

const channelMock = {
  on: vi.fn(function (
    this: typeof channelMock,
    _type: string,
    filter: { event: string },
    callback: () => void,
  ) {
    presenceCallbacks.set(filter.event, callback);
    return channelMock;
  }),
  subscribe: vi.fn((cb: (status: string) => void) => {
    subscribeCallback = cb;
    queueMicrotask(() => cb("SUBSCRIBED"));
    return channelMock;
  }),
  track: vi.fn(async () => "ok"),
  untrack: vi.fn(async () => "ok"),
  presenceState: vi.fn(() => ({
    "user-b": [{ user_id: "user-b", typing: true, at: Date.now() }],
  })),
};

const supabaseChannelMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    channel: supabaseChannelMock,
    removeChannel: removeChannelMock,
  },
}));

const loggerDebugMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({
  logger: { debug: loggerDebugMock },
}));

describe("useConversationTypingPresence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCallback = null;
    presenceCallbacks.clear();
    supabaseChannelMock.mockReturnValue(channelMock);
    channelMock.track.mockResolvedValue("ok");
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

  it("debounces clearing the remote typing indicator", async () => {
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
    expect(result.current.isCounterpartyTyping).toBe(true);

    channelMock.presenceState.mockReturnValue({});
    act(() => presenceCallbacks.get("sync")?.());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(result.current.isCounterpartyTyping).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.isCounterpartyTyping).toBe(false);
  });

  it("does not connect or publish when disabled", () => {
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
        enabled: false,
      }),
    );

    act(() => {
      result.current.notifyComposerChange();
      result.current.notifyTypingStopNow();
    });

    expect(supabaseChannelMock).not.toHaveBeenCalled();
    expect(channelMock.track).not.toHaveBeenCalled();
  });

  it("reconnects after a dropped channel", async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => subscribeCallback?.("CHANNEL_ERROR"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(supabaseChannelMock).toHaveBeenCalledTimes(2);
    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
    expect(loggerDebugMock).toHaveBeenCalledWith(
      "chats_typing_presence_channel_dropped",
      expect.objectContaining({ status: "CHANNEL_ERROR" }),
    );
  });

  it("logs rejected presence publishing without failing the hook", async () => {
    channelMock.track.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    act(() => result.current.notifyComposerChange());
    await waitFor(() =>
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "chats_typing_presence_track_failed",
        expect.objectContaining({ typing: true, error: "offline" }),
      ),
    );
  });

  it("tears down the active channel on unmount", async () => {
    const { unmount } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    unmount();

    await waitFor(() => expect(removeChannelMock).toHaveBeenCalledWith(channelMock));
  });

  it("does not connect when conversation or user is missing", () => {
    renderHook(() =>
      useConversationTypingPresence({
        conversationId: null,
        currentUserId: "user-a",
      }),
    );
    renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: null,
      }),
    );

    expect(supabaseChannelMock).not.toHaveBeenCalled();
  });

  it("no-ops notifyTypingStopNow when not currently typing", async () => {
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    act(() => {
      result.current.notifyTypingStopNow();
    });

    expect(channelMock.track).not.toHaveBeenCalled();
  });

  it("resumes a local typing session after reconnect", async () => {
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
    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ typing: true }),
    );

    act(() => subscribeCallback?.("TIMED_OUT"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_PRESENCE_PUBLISH_INTERVAL_MS + 1_000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(supabaseChannelMock).toHaveBeenCalledTimes(2);
    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ typing: true }),
    );
  });

  it("cancels a pending remote clear when typing resumes", async () => {
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
    expect(result.current.isCounterpartyTyping).toBe(true);

    channelMock.presenceState.mockReturnValue({});
    act(() => presenceCallbacks.get("sync")?.());

    channelMock.presenceState.mockReturnValue({
      "user-b": [{ user_id: "user-b", typing: true, at: Date.now() }],
    });
    act(() => presenceCallbacks.get("join")?.());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current.isCounterpartyTyping).toBe(true);
  });

  it("handles leave events and CLOSED reconnect status", async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => presenceCallbacks.get("leave")?.());
    act(() => subscribeCallback?.("CLOSED"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(supabaseChannelMock).toHaveBeenCalledTimes(2);
    expect(loggerDebugMock).toHaveBeenCalledWith(
      "chats_typing_presence_channel_dropped",
      expect.objectContaining({ status: "CLOSED" }),
    );
  });

  it("logs non-Error track failures as strings", async () => {
    channelMock.track.mockRejectedValueOnce("offline-string");
    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());

    act(() => result.current.notifyComposerChange());
    await waitFor(() =>
      expect(loggerDebugMock).toHaveBeenCalledWith(
        "chats_typing_presence_track_failed",
        expect.objectContaining({ error: "offline-string" }),
      ),
    );
  });

  it("ignores subscribe callbacks after the channel is replaced", async () => {
    vi.useFakeTimers();
    const firstSubscribe = channelMock.subscribe;
    let firstCb: ((status: string) => void) | null = null;
    channelMock.subscribe.mockImplementationOnce((cb: (status: string) => void) => {
      firstCb = cb;
      return channelMock;
    });

    const { unmount } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    unmount();
    act(() => firstCb?.("SUBSCRIBED"));
    expect(firstSubscribe).toHaveBeenCalled();
  });

  it("throttles typing:true publishes inside the interval window", async () => {
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

    act(() => result.current.notifyComposerChange());
    expect(channelMock.track).toHaveBeenCalledTimes(1);

    act(() => result.current.notifyComposerChange());
    expect(channelMock.track).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_PRESENCE_PUBLISH_INTERVAL_MS + 1);
    });
    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ typing: true }),
    );
  });

  it("always publishes typing:false even inside the throttle window", async () => {
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

    act(() => result.current.notifyComposerChange());
    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ typing: true }),
    );
    channelMock.track.mockClear();

    act(() => result.current.notifyTypingStopNow());
    expect(channelMock.track).toHaveBeenCalledWith(
      expect.objectContaining({ typing: false }),
    );
  });

  it("does not publish before the channel is SUBSCRIBED", async () => {
    channelMock.subscribe.mockImplementationOnce((cb: (status: string) => void) => {
      subscribeCallback = cb;
      return channelMock;
    });

    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );

    act(() => result.current.notifyComposerChange());
    expect(channelMock.track).not.toHaveBeenCalled();

    act(() => subscribeCallback?.("SUBSCRIBED"));
    act(() => result.current.notifyComposerChange());
    await waitFor(() =>
      expect(channelMock.track).toHaveBeenCalledWith(
        expect.objectContaining({ typing: true }),
      ),
    );
  });

  it("hides counterparty typing after TTL expires", async () => {
    vi.useFakeTimers();
    channelMock.presenceState.mockReturnValue({
      "user-b": [{ user_id: "user-b", typing: true, at: Date.now() }],
    });

    const { result } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isCounterpartyTyping).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_PRESENCE_TTL_MS + 600);
    });
    expect(result.current.isCounterpartyTyping).toBe(false);
  });

  it("ignores non-terminal subscribe statuses", async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    const callsBefore = supabaseChannelMock.mock.calls.length;
    act(() => subscribeCallback?.("CHANNEL_JOINING" as never));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(supabaseChannelMock).toHaveBeenCalledTimes(callsBefore);
  });

  it("skips keep-alive publish when typing session already ended", async () => {
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

    act(() => result.current.notifyComposerChange());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_ACTIVITY_IDLE_MS);
    });
    channelMock.track.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TYPING_PRESENCE_PUBLISH_INTERVAL_MS);
    });
    expect(channelMock.track).not.toHaveBeenCalled();
  });

  it("cancels a pending reconnect when the effect is torn down", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() =>
      useConversationTypingPresence({
        conversationId: "chat-1",
        currentUserId: "user-a",
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => subscribeCallback?.("TIMED_OUT"));
    unmount();

    const callsAfterUnmount = supabaseChannelMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(supabaseChannelMock).toHaveBeenCalledTimes(callsAfterUnmount);
  });

  it("does not sync remote typing when current user id becomes unavailable", async () => {
    const { rerender } = renderHook(
      ({ userId }: { userId: string | null }) =>
        useConversationTypingPresence({
          conversationId: "chat-1",
          currentUserId: userId,
        }),
      { initialProps: { userId: "user-a" as string | null } },
    );
    await act(async () => {
      await Promise.resolve();
    });

    rerender({ userId: null });
    act(() => presenceCallbacks.get("sync")?.());
  });
});
