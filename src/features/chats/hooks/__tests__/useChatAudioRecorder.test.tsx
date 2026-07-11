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

  it("toasts and resets when starting the recorder fails", async () => {
    const { toast } = await import("sonner");
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => "id");
    startMock.mockRejectedValueOnce(new Error("mic denied"));

    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(toastError).toHaveBeenCalledWith("mic denied");
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isBusy).toBe(false);
    toastError.mockRestore();
  });

  it("cancels an active recording and clears state", async () => {
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      await result.current.cancelRecording();
    });

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.elapsedMs).toBe(0);
  });

  it("rejects invalid audio on stop and returns null", async () => {
    const { toast } = await import("sonner");
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => "id");
    stopAsFileMock.mockResolvedValueOnce({
      file: new File(["x"], "voice.webm", { type: "audio/webm" }),
      durationMs: 200,
    });

    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    let sendResult: Awaited<ReturnType<typeof result.current.stopRecording>> = null;
    await act(async () => {
      sendResult = await result.current.stopRecording();
    });

    expect(sendResult).toBeNull();
    expect(toastError).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    toastError.mockRestore();
  });

  it("returns null when stopped before a recording starts", async () => {
    const { result } = renderHook(() => useChatAudioRecorder());
    let stopped: Awaited<ReturnType<typeof result.current.stopRecording>> = null;

    await act(async () => {
      stopped = await result.current.stopRecording();
    });

    expect(stopped).toBeNull();
    expect(stopAsFileMock).not.toHaveBeenCalled();
    expect(result.current.isBusy).toBe(false);
  });

  it("clamps oversized recording duration before returning the file", async () => {
    stopAsFileMock.mockResolvedValueOnce({
      file: new File(["audio"], "voice.webm", { type: "audio/webm" }),
      durationMs: MAX_AUDIO_DURATION_MS + 10_000,
    });
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    let stopped: Awaited<ReturnType<typeof result.current.stopRecording>> = null;
    await act(async () => {
      stopped = await result.current.stopRecording();
    });

    expect(stopped?.durationMs).toBe(MAX_AUDIO_DURATION_MS);
  });

  it("reports non-Error finalization failures with fallback copy", async () => {
    const { toast } = await import("sonner");
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => "id");
    stopAsFileMock.mockRejectedValueOnce("recorder stopped");
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(toastError).toHaveBeenCalledWith("Não foi possível finalizar a gravação.");
    expect(result.current.isRecording).toBe(false);
    toastError.mockRestore();
  });

  it("smooths amplitude samples and decays after polling errors", async () => {
    amplitudeMock
      .mockResolvedValueOnce(0.8)
      .mockRejectedValueOnce(new Error("meter unavailable"));
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
      await vi.advanceTimersByTimeAsync(50);
    });
    const sampledAmplitude = result.current.amplitude;
    expect(sampledAmplitude).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.amplitude).toBeLessThan(sampledAmplitude);
  });

  it("swallows cancellation failures and skips native cancel when idle", async () => {
    cancelMock.mockRejectedValueOnce(new Error("already stopped"));
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.cancelRecording();
    });
    expect(result.current.isRecording).toBe(false);

    cancelMock.mockClear();
    await act(async () => {
      await result.current.cancelRecording();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it("ignores a second start while already recording", async () => {
    const { result } = renderHook(() => useChatAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
      await result.current.startRecording();
    });

    expect(startMock).toHaveBeenCalledTimes(1);
  });
});