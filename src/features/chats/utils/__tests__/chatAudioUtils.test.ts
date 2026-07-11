import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_MS } from "../chatAudioConstants";
import {
  buildAudioMessageSendPayload,
  getChatAudioDurationMs,
  getChatAudioPathFromPayload,
} from "../chatMessageAudioPaths";
import {
  isAllowedChatAudioMimeType,
  resolveChatAudioMimeType,
  validateChatAudioFile,
} from "../chatAudioValidation";
import { formatAudioDuration } from "../formatAudioDuration";

describe("chatMessageAudioPaths", () => {
  it("builds server payload with preview label", () => {
    const payload = buildAudioMessageSendPayload({
      uploadSessionId: "11111111-1111-4111-8111-111111111111",
      path: "chat/session/audio.webm",
      durationMs: 12_000,
      mimeType: "audio/webm",
    });

    expect(payload.preview).toBe("Áudio");
    expect(payload.duration_ms).toBe(12_000);
    expect(getChatAudioDurationMs(payload)).toBe(12_000);
  });

  it("reads a trimmed audio path from payload", () => {
    expect(getChatAudioPathFromPayload({ path: "  chat/s/a.webm  " })).toBe(
      "chat/s/a.webm",
    );
    expect(getChatAudioPathFromPayload({ path: "" })).toBeNull();
    expect(getChatAudioPathFromPayload({ path: 12 })).toBeNull();
  });

  it("returns zero duration for non-finite values", () => {
    expect(getChatAudioDurationMs({ duration_ms: Number.NaN })).toBe(0);
    expect(getChatAudioDurationMs({ duration_ms: "12" })).toBe(0);
  });
});

describe("chatAudioValidation", () => {
  it("resolves Android native octet-stream recordings from m4a path", () => {
    expect(
      resolveChatAudioMimeType(
        "application/octet-stream",
        "file:///data/cache/capacitor-audio-recorder/recording-20260705-120000.m4a",
      ),
    ).toBe("audio/mp4");
  });

  it("keeps an already trusted mime type", () => {
    expect(resolveChatAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(isAllowedChatAudioMimeType("audio/ogg")).toBe(true);
  });

  it("defaults to audio/mp4 when mime and extension are unknown", () => {
    expect(resolveChatAudioMimeType("application/octet-stream", "clip.bin")).toBe(
      "audio/mp4",
    );
  });

  it("accepts native recordings with generic blob type", () => {
    const file = new File([new Uint8Array(1024)], "recording-20260705-120000.m4a", {
      type: "application/octet-stream",
    });
    expect(validateChatAudioFile(file, 5_000)).toBeNull();
  });

  it("rejects audio shorter than one second", () => {
    const file = new File(["x"], "voice.webm", { type: "audio/webm" });
    expect(validateChatAudioFile(file, 500)).toMatch(/1 segundo/);
  });

  it("rejects audio longer than two minutes", () => {
    const file = new File(["x"], "voice.webm", { type: "audio/webm" });
    expect(validateChatAudioFile(file, 121_000)).toMatch(/2 minutos/);
  });

  it("accepts a two-minute clip within the upload byte budget", () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], "voice.m4a", {
      type: "audio/mp4",
    });
    expect(validateChatAudioFile(file, MAX_AUDIO_DURATION_MS)).toBeNull();
  });

  it("rejects files above the upload byte budget", () => {
    const file = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], "voice.m4a", {
      type: "audio/mp4",
    });
    expect(validateChatAudioFile(file, 30_000)).toMatch(/grande demais/);
  });

  it("resolves mime from common extensions and rejects disallowed declared types", () => {
    expect(resolveChatAudioMimeType("binary/octet-stream", "clip.webm")).toBe("audio/webm");
    expect(resolveChatAudioMimeType("binary/octet-stream", "clip.ogg")).toBe("audio/ogg");
    expect(resolveChatAudioMimeType("binary/octet-stream", "clip.aac")).toBe("audio/aac");
    expect(resolveChatAudioMimeType("", "clip.mp4")).toBe("audio/mp4");
    expect(isAllowedChatAudioMimeType("video/mp4")).toBe(false);
    expect(isAllowedChatAudioMimeType("")).toBe(false);
  });
});

describe("formatAudioDuration", () => {
  it("formats mm:ss", () => {
    expect(formatAudioDuration(45_000)).toBe("0:45");
    expect(formatAudioDuration(125_000)).toBe("2:05");
    expect(formatAudioDuration(-1_000)).toBe("0:00");
  });
});
