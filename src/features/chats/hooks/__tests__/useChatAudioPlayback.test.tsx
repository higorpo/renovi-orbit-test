// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatAudioPlayback } from "../../hooks/useChatAudioPlayback";
import { resetChatAudioPlaybackCoordinator } from "../../utils/chatAudioPlaybackCoordinator";
import type { ChatMessageListItem } from "../../types/chats.types";

const resolveChatAudioSignedUrlMock = vi.hoisted(() =>
  vi.fn(async () => ({
    url: "https://example.com/audio.webm",
    error: null,
  })),
);

vi.mock("../../api/chatMedia.api", () => ({
  resolveChatAudioSignedUrl: resolveChatAudioSignedUrlMock,
}));

function buildAudioMessage(id: string): ChatMessageListItem {
  return {
    id,
    chat_id: "11111111-1111-4111-8111-111111111111",
    sender_id: "22222222-2222-4222-8222-222222222222",
    message_type: "AUDIO",
    payload: {
      path: `${id}/session/audio.webm`,
      duration_ms: 10_000,
      mime_type: "audio/webm",
      upload_session_id: "33333333-3333-4333-8333-333333333333",
    },
    created_at: "2026-06-04T12:00:00.000Z",
    delivery_status: "DELIVERED",
  };
}

describe("useChatAudioPlayback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveChatAudioSignedUrlMock.mockResolvedValue({
      url: "https://example.com/audio.webm",
      error: null,
    });
  });

  afterEach(() => {
    resetChatAudioPlaybackCoordinator();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pauses other audio messages when a new one starts playing", async () => {
    const playMock = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

    const messageA = buildAudioMessage("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const messageB = buildAudioMessage("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    const hookA = renderHook(() => useChatAudioPlayback(messageA));
    const hookB = renderHook(() => useChatAudioPlayback(messageB));

    await act(async () => {
      await hookA.result.current.togglePlay();
    });
    await act(async () => {
      await hookB.result.current.togglePlay();
    });

    expect(hookA.result.current.isPlaying).toBe(false);
    expect(hookB.result.current.isPlaying).toBe(true);
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("loads an optimistic audio URL without a message id", async () => {
    const playMock = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const message = buildAudioMessage("optimistic:audio-1");
    const { result } = renderHook(() => useChatAudioPlayback(message));

    await act(async () => {
      await result.current.togglePlay();
    });

    expect(resolveChatAudioSignedUrlMock).toHaveBeenCalledWith({
      messageId: undefined,
      path: "optimistic:audio-1/session/audio.webm",
    });
    expect(playMock).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it("pauses the current message when toggled while playing", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pauseMock = vi
      .spyOn(window.HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const { result } = renderHook(() =>
      useChatAudioPlayback(buildAudioMessage("cccccccc-cccc-4ccc-8ccc-cccccccccccc")),
    );

    await act(async () => {
      await result.current.togglePlay();
    });
    await act(async () => {
      await result.current.togglePlay();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(pauseMock).toHaveBeenCalled();
  });

  it("exposes URL and playback failures", async () => {
    resolveChatAudioSignedUrlMock.mockResolvedValueOnce({ url: null, error: "denied" });
    const failedLoad = renderHook(() =>
      useChatAudioPlayback(buildAudioMessage("dddddddd-dddd-4ddd-8ddd-dddddddddddd")),
    );

    await act(async () => {
      await failedLoad.result.current.togglePlay();
    });
    expect(failedLoad.result.current.hasError).toBe(true);
    expect(failedLoad.result.current.isLoading).toBe(false);

    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("blocked"));
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    const failedPlay = renderHook(() =>
      useChatAudioPlayback(buildAudioMessage("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")),
    );
    await act(async () => {
      await failedPlay.result.current.togglePlay();
    });
    expect(failedPlay.result.current.hasError).toBe(true);
    expect(failedPlay.result.current.isPlaying).toBe(false);
  });

  it("clamps seeks and cycles playback speed", () => {
    const { result } = renderHook(() =>
      useChatAudioPlayback(buildAudioMessage("ffffffff-ffff-4fff-8fff-ffffffffffff")),
    );

    act(() => result.current.seekToMs(15_000));
    expect(result.current.currentTimeMs).toBe(10_000);

    act(() => result.current.seekToMs(-100));
    expect(result.current.currentTimeMs).toBe(0);

    act(() => result.current.cycleSpeed());
    expect(result.current.playbackRate).toBe(1.25);
  });

  it("updates time and completion from audio events", async () => {
    class FakeAudio {
      static latest: FakeAudio | null = null;
      src: string;
      preload = "";
      playbackRate = 1;
      currentTime = 0;
      listeners = new Map<string, () => void>();
      pause = vi.fn();
      play = vi.fn().mockResolvedValue(undefined);

      constructor(url: string) {
        this.src = url;
        FakeAudio.latest = this;
      }

      addEventListener(name: string, listener: () => void) {
        this.listeners.set(name, listener);
      }
    }
    vi.stubGlobal("Audio", FakeAudio);
    const { result } = renderHook(() =>
      useChatAudioPlayback(buildAudioMessage("12121212-1212-4121-8121-121212121212")),
    );

    await act(async () => {
      await result.current.togglePlay();
    });
    act(() => {
      if (FakeAudio.latest) {
        FakeAudio.latest.currentTime = 2.345;
        FakeAudio.latest.listeners.get("timeupdate")?.();
      }
    });
    expect(result.current.currentTimeMs).toBe(2345);

    act(() => FakeAudio.latest?.listeners.get("ended")?.());
    expect(result.current.currentTimeMs).toBe(10_000);
    expect(result.current.isPlaying).toBe(false);
  });

  it("does nothing when the message has no audio path", async () => {
    const message = buildAudioMessage("13131313-1313-4131-8131-131313131313");
    message.payload = { duration_ms: 1_000 };
    const { result } = renderHook(() => useChatAudioPlayback(message));

    await act(async () => {
      await result.current.togglePlay();
    });

    expect(result.current.amplitudeReady).toBe(false);
    expect(resolveChatAudioSignedUrlMock).not.toHaveBeenCalled();
  });
});
