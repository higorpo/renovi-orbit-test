import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rememberSentChatMessageId,
  wasRecentlySentChatMessageId,
} from "../chatMessageSendSync";

describe("chatMessageSendSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a message as recently sent until TTL expires", () => {
    rememberSentChatMessageId("msg-own");

    expect(wasRecentlySentChatMessageId("msg-own")).toBe(true);
    expect(wasRecentlySentChatMessageId("msg-other")).toBe(false);

    vi.advanceTimersByTime(15_001);

    expect(wasRecentlySentChatMessageId("msg-own")).toBe(false);
  });
});
