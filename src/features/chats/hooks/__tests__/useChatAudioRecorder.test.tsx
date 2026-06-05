// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_DURATION_MS } from "../../utils/chatAudioConstants";
import { useChatAudioRecorder } from "../useChatAudioRecorder";

const startMock = vi.fn(async () => undefined);
const stopAsFileMock = vi.fn(async () => ({
  file: new File(["audio"], "voice.webm", { type: "audio/webm" }),
  durationMs: MAX_AUDIO_DURATION_MS,
}));
const cancelMock = vi.fn(async () => undefined);
const amplitudeMock = vi.fn(async () => 0.12);

vi.mock("@/lib/capacitor/audioRecorder", () => ({
  startChatAudioRecording: (...args: unknown[]) => startMock(...args),
  stopChatAudioRecordingAsFile: (...args: unknown[]) => stopAsFileMock(...args),
  cancelChatAudioRecording: (...args: unknown[]) => cancelMock(...args),
  getChatAudioAmplitude: (...args: unknown[]) => amplitudeMock(...args),
}));

describe("useChatAudioRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startMock.mockClear();
    stopAsFileMock.mockClear();
    cancelMock.mockClear();
    amplitudeMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a pending recording at max duration instead of resetting", async () => {
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(MAX_AUDIO_DURATION_MS + 400);
      await Promise.resolve();
    });

    expect(stopAsFileMock).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.hasPendingRecording).toBe(true);
    expect(result.current.hitMaxDuration).toBe(true);
    expect(result.current.elapsedMs).toBe(MAX_AUDIO_DURATION_MS);
  });

  it("returns pending recording on send after max duration", async () => {
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      vi.advanceTimersByTime(MAX_AUDIO_DURATION_MS + 400);
      await Promise.resolve();
    });

    let sendResult: Awaited<ReturnType<typeof result.current.stopRecording>> = null;

    await act(async () => {
      sendResult = await result.current.stopRecording();
    });

    expect(sendResult).toEqual({
      file: expect.any(File),
      durationMs: MAX_AUDIO_DURATION_MS,
    });
    expect(result.current.hasPendingRecording).toBe(false);
  });
});
