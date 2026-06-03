import { describe, expect, it } from "vitest";
import {
  extractChatIdFromPushPayload,
  pushNotificationCollapseKey,
} from "../pushCollapseKey";

describe("pushNotificationCollapseKey", () => {
  it("prefers chat_id over dispatch_id", () => {
    const payload = {
      data: { chat_id: "chat-a", dispatch_id: "dispatch-1" },
    };
    expect(pushNotificationCollapseKey(payload, "fallback")).toBe("chat-a");
  });

  it("extracts chat id from deep_link_path", () => {
    const payload = {
      data: { deep_link_path: "/chats/abc-123" },
    };
    expect(extractChatIdFromPushPayload(payload)).toBe("abc-123");
    expect(pushNotificationCollapseKey(payload, "fallback")).toBe("abc-123");
  });

  it("falls back to dispatch_id then tag then default", () => {
    expect(
      pushNotificationCollapseKey({ data: { dispatch_id: "d-1" } }, "fallback"),
    ).toBe("d-1");
    expect(pushNotificationCollapseKey({ data: { tag: "custom" } }, "fallback")).toBe(
      "custom",
    );
    expect(pushNotificationCollapseKey({}, "fallback")).toBe("fallback");
  });
});
