import { describe, expect, it } from "vitest";
import {
  isChatSentryFeature,
  scrubChatSensitiveData,
  scrubChatSentryEvent,
  scrubMessagePayload,
} from "../sentryChatScrubbing";

describe("sentryChatScrubbing", () => {
  it("redacts payload.text from message payloads", () => {
    expect(scrubMessagePayload({ text: "hello", image_path: "a/b.jpg" })).toEqual({
      text: "[redacted]",
      image_path: "a/b.jpg",
    });
  });

  it("redacts nested chat message fields while preserving ids", () => {
    const input = {
      chat_id: "chat-1",
      service_request_id: "sr-1",
      payload: { text: "secret message" },
      message: "also secret",
    };

    expect(scrubChatSensitiveData(input)).toEqual({
      chat_id: "chat-1",
      service_request_id: "sr-1",
      payload: { text: "[redacted]" },
      message: "[redacted]",
    });
  });

  it("scrubs breadcrumbs on chat sentry events", () => {
    const event = scrubChatSentryEvent({
      type: undefined,
      breadcrumbs: [
        {
          message: "chat.send_failed",
          data: {
            chat_id: "chat-1",
            payload: { text: "private" },
          },
        },
      ],
    });

    expect(event.breadcrumbs?.[0]?.data).toEqual({
      chat_id: "chat-1",
      payload: { text: "[redacted]" },
    });
  });

  it("detects chat feature tag", () => {
    expect(isChatSentryFeature({ feature: "chats" })).toBe(true);
    expect(isChatSentryFeature({ feature: "auth" })).toBe(false);
  });
});
