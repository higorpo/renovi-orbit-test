// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatAudioPlayback } from "../../hooks/useChatAudioPlayback";
import { resetChatAudioPlaybackCoordinator } from "../../utils/chatAudioPlaybackCoordinator";
import type { ChatMessageListItem } from "../../types/chats.types";

vi.mock("../../api/chatMedia.api", () => ({
  resolveChatAudioSignedUrl: vi.fn(async () => ({
    url: "https://example.com/audio.webm",
    error: null,
  })),
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
  afterEach(() => {
    resetChatAudioPlaybackCoordinator();
    vi.restoreAllMocks();
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
});
