// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  convertFileSrc: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  cancelRecording: vi.fn(),
  getCurrentAmplitude: vi.fn(),
  getRecordingStatus: vi.fn(),
  resolveMimeType: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    convertFileSrc: mocks.convertFileSrc,
  },
}));

vi.mock("@capgo/capacitor-audio-recorder", () => ({
  CapacitorAudioRecorder: {
    startRecording: mocks.startRecording,
    stopRecording: mocks.stopRecording,
    cancelRecording: mocks.cancelRecording,
    getCurrentAmplitude: mocks.getCurrentAmplitude,
    getRecordingStatus: mocks.getRecordingStatus,
  },
  RecordingStatus: { RECORDING: "RECORDING", NONE: "NONE" },
}));

vi.mock("@/features/chats/utils/chatAudioConstants", () => ({
  CHAT_AUDIO_BIT_RATE: 32000,
  CHAT_AUDIO_SAMPLE_RATE: 16000,
}));

vi.mock("@/features/chats/utils/chatAudioValidation", () => ({
  resolveChatAudioMimeType: mocks.resolveMimeType,
}));

import {
  cancelChatAudioRecording,
  getChatAudioAmplitude,
  getChatAudioRecordingStatus,
  startChatAudioRecording,
  stopChatAudioRecording,
  stopChatAudioRecordingAsFile,
} from "../audioRecorder";

describe("audioRecorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.resolveMimeType.mockImplementation((type: string) => type || "audio/webm");
  });

  it("delegates recorder lifecycle operations", async () => {
    mocks.stopRecording.mockResolvedValue({ uri: "file://voice.m4a", duration: 10 });
    mocks.getCurrentAmplitude.mockResolvedValue({ value: 0.42 });
    mocks.getRecordingStatus.mockResolvedValue({ status: "RECORDING" });

    await startChatAudioRecording();
    await expect(stopChatAudioRecording()).resolves.toEqual({
      uri: "file://voice.m4a",
      duration: 10,
    });
    await cancelChatAudioRecording();
    await expect(getChatAudioAmplitude()).resolves.toBe(0.42);
    await expect(getChatAudioRecordingStatus()).resolves.toBe("RECORDING");

    expect(mocks.startRecording).toHaveBeenCalledWith({
      bitRate: 32000,
      sampleRate: 16000,
    });
    expect(mocks.cancelRecording).toHaveBeenCalledOnce();
  });

  it("creates a webm file from a returned blob and rounds duration", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm;codecs=opus" });
    mocks.stopRecording.mockResolvedValue({ blob, duration: 1250.6 });
    mocks.resolveMimeType.mockReturnValue("audio/webm");

    const result = await stopChatAudioRecordingAsFile("message.audio");

    expect(result.durationMs).toBe(1251);
    expect(result.file.name).toBe("message.webm");
    expect(result.file.type).toBe("audio/webm");
  });

  it("estimates duration when the web plugin omits it", async () => {
    const blob = new Blob([new Uint8Array(8000)], { type: "audio/aac" });
    mocks.stopRecording.mockResolvedValue({ blob });
    mocks.resolveMimeType.mockReturnValue("audio/aac");

    const result = await stopChatAudioRecordingAsFile();

    expect(result.durationMs).toBe(2000);
    expect(result.file.name).toBe("voice-message.aac");
  });

  it("reads a native URI and preserves its decoded filename", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.stopRecording.mockResolvedValue({
      uri: "file:///recordings/my%20voice.m4a?cache=1",
      duration: -12,
    });
    mocks.convertFileSrc.mockReturnValue("capacitor://localhost/recording");
    mocks.resolveMimeType.mockReturnValue("audio/mp4");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(["native"], { type: "audio/mp4" })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await stopChatAudioRecordingAsFile();

    expect(fetchMock).toHaveBeenCalledWith("capacitor://localhost/recording");
    expect(result.file.name).toBe("my%20voice.m4a");
    expect(result.file.type).toBe("audio/mp4");
    expect(result.durationMs).toBe(0);
  });

  it("throws when the recorder returns no audio data", async () => {
    mocks.stopRecording.mockResolvedValue({ duration: 10 });

    await expect(stopChatAudioRecordingAsFile()).rejects.toThrow(
      "Recording result missing audio data",
    );
  });

  it("throws when a native recording cannot be read", async () => {
    mocks.stopRecording.mockResolvedValue({ uri: "file:///voice.m4a" });
    mocks.convertFileSrc.mockReturnValue("capacitor://voice");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(stopChatAudioRecordingAsFile()).rejects.toThrow(
      "Failed to read recorded audio file",
    );
  });
});
