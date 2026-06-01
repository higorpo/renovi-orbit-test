import { describe, expect, it, vi } from "vitest";
import {
  canPublishTypingPresence,
  isRemoteTypingVisible,
  parseTypingPresenceState,
  TYPING_PRESENCE_PUBLISH_INTERVAL_MS,
  TYPING_PRESENCE_TTL_MS,
} from "../typingPresence";

describe("typingPresence", () => {
  it("throttles publish to at most one event per 2s", () => {
    const t0 = 1_000_000;
    expect(canPublishTypingPresence(t0, null)).toBe(true);
    expect(canPublishTypingPresence(t0 + 1_000, t0)).toBe(false);
    expect(canPublishTypingPresence(t0 + TYPING_PRESENCE_PUBLISH_INTERVAL_MS, t0)).toBe(true);
  });

  it("allows stop events to bypass the publish interval", () => {
    const t0 = 1_000_000;
    expect(canPublishTypingPresence(t0 + 500, t0, { bypassInterval: true })).toBe(true);
    expect(canPublishTypingPresence(t0 + 500, t0)).toBe(false);
  });

  it("expires remote typing indicator after TTL without heartbeat", () => {
    vi.useFakeTimers();
    const seenAt = Date.now();
    vi.setSystemTime(seenAt);

    expect(isRemoteTypingVisible(seenAt, seenAt, TYPING_PRESENCE_TTL_MS)).toBe(true);

    vi.setSystemTime(seenAt + TYPING_PRESENCE_TTL_MS - 1);
    expect(isRemoteTypingVisible(seenAt, Date.now(), TYPING_PRESENCE_TTL_MS)).toBe(true);

    vi.setSystemTime(seenAt + TYPING_PRESENCE_TTL_MS);
    expect(isRemoteTypingVisible(seenAt, Date.now(), TYPING_PRESENCE_TTL_MS)).toBe(false);

    vi.useRealTimers();
  });

  it("parses other participant typing from presence state", () => {
    const state = {
      "user-a": [{ user_id: "user-a", typing: false, at: 1 }],
      "user-b": [{ user_id: "user-b", typing: true, at: 2 }],
    };
    expect(parseTypingPresenceState(state, "user-a")).toBe(true);
    expect(parseTypingPresenceState(state, "user-b")).toBe(false);
  });

  it("uses the remote entry with the latest at timestamp", () => {
    const state = {
      "user-b": [
        { user_id: "user-b", typing: true, at: 100 },
        { user_id: "user-b", typing: false, at: 200 },
      ],
    };
    expect(parseTypingPresenceState(state, "user-a")).toBe(false);
  });
});
