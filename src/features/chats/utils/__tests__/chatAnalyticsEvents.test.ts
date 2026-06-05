import { describe, expect, it } from "vitest";
import {
  buildChatAnalyticsPayload,
  CHAT_ANALYTICS_EVENT_NAMES,
  CHAT_ANALYTICS_SCHEMA_VERSION,
  isChatAnalyticsEventName,
  sanitizeChatAnalyticsProperties,
} from "../chatAnalyticsEvents";

describe("chatAnalyticsEvents", () => {
  it("registers the v1 chat analytics event names", () => {
    expect(CHAT_ANALYTICS_EVENT_NAMES).toEqual([
      "negotiation_message_sent",
      "proposal_submitted",
      "proposal_accepted",
      "proposal_rejected",
      "revision_requested",
      "conversation_closed",
    ]);
    expect(isChatAnalyticsEventName("proposal_submitted")).toBe(true);
    expect(isChatAnalyticsEventName("quote_request_started")).toBe(false);
  });

  it("builds versioned payloads without PII fields", () => {
    const payload = buildChatAnalyticsPayload("negotiation_message_sent", {
      message_id: "msg-1",
      message_type: "TEXT",
      chat_id: "chat-1",
      service_request_id: "sr-1",
      text: "secret",
      sender_user_id: "user-1",
    } as never);

    expect(payload).toEqual({
      event: "negotiation_message_sent",
      schema_version: CHAT_ANALYTICS_SCHEMA_VERSION,
      message_id: "msg-1",
      message_type: "TEXT",
      chat_id: "chat-1",
      service_request_id: "sr-1",
    });
  });

  it("sanitizes nested forbidden keys from loose property bags", () => {
    expect(
      sanitizeChatAnalyticsProperties({
        chat_id: "chat-1",
        email: "user@example.com",
        closure_reason: "too expensive",
        revision_count: 1,
      }),
    ).toEqual({
      chat_id: "chat-1",
      revision_count: 1,
    });
  });
});
