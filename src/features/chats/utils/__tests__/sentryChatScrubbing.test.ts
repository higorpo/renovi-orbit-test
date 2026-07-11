import { describe, expect, it } from "vitest";
import {
  isChatSentryFeature,
  scrubChatBreadcrumbData,
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

  it("leaves non-object payloads unchanged", () => {
    expect(scrubMessagePayload("plain")).toBe("plain");
    expect(scrubMessagePayload(null)).toBeNull();
    expect(scrubMessagePayload(["a"])).toEqual(["a"]);
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

  it("scrubs arrays and known content keys recursively", () => {
    expect(
      scrubChatSensitiveData([
        { Body: "secret", content: "x", nested: { payload_text: "y" } },
        "keep",
      ]),
    ).toEqual([
      { Body: "[redacted]", content: "[redacted]", nested: { payload_text: "[redacted]" } },
      "keep",
    ]);
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
        {
          message: "no-data",
        },
      ],
    });

    expect(event.breadcrumbs?.[0]?.data).toEqual({
      chat_id: "chat-1",
      payload: { text: "[redacted]" },
    });
    expect(event.breadcrumbs?.[1]?.data).toBeUndefined();
  });

  it("scrubs extra and contexts on sentry events", () => {
    const event = scrubChatSentryEvent({
      type: undefined,
      extra: {
        text: "secret",
        chat_id: "chat-1",
      },
      contexts: {
        chat: {
          message: "private",
          id: "msg-1",
        },
      },
    });

    expect(event.extra).toEqual({
      text: "[redacted]",
      chat_id: "chat-1",
    });
    expect(event.contexts).toEqual({
      chat: {
        message: "[redacted]",
        id: "msg-1",
      },
    });
  });

  it("scrubs breadcrumb data helpers", () => {
    expect(scrubChatBreadcrumbData(undefined)).toBeUndefined();
    expect(scrubChatBreadcrumbData({ text: "secret", chat_id: "c1" })).toEqual({
      text: "[redacted]",
      chat_id: "c1",
    });
  });

  it("detects chat feature tag", () => {
    expect(isChatSentryFeature({ feature: "chats" })).toBe(true);
    expect(isChatSentryFeature({ feature: "auth" })).toBe(false);
    expect(isChatSentryFeature(undefined)).toBe(false);
  });
});
