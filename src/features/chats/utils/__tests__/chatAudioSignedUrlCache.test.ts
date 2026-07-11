import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildChatAudioDisplayCacheKey,
  getCachedChatAudioDisplayUrl,
  setCachedChatAudioDisplayUrl,
} from "../chatAudioSignedUrlCache";

describe("chatAudioSignedUrlCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a stable key from message id and path", () => {
    expect(buildChatAudioDisplayCacheKey("msg-1", "chat/s/a.webm")).toBe(
      "msg-1\0chat/s/a.webm",
    );
  });

  it("stores and retrieves a signed url before expiry", () => {
    const key = buildChatAudioDisplayCacheKey("msg-2", "chat/s/b.m4a");
    expect(getCachedChatAudioDisplayUrl(key)).toBeNull();

    setCachedChatAudioDisplayUrl(key, "https://signed.example/b.m4a");

    expect(getCachedChatAudioDisplayUrl(key)).toBe("https://signed.example/b.m4a");
  });

  it("returns null after the cache entry expires", () => {
    vi.useFakeTimers();
    const key = buildChatAudioDisplayCacheKey("msg-3", "chat/s/c.webm");
    setCachedChatAudioDisplayUrl(key, "https://signed.example/c.webm");

    vi.advanceTimersByTime(50 * 60 * 1000);

    expect(getCachedChatAudioDisplayUrl(key)).toBeNull();
  });
});
