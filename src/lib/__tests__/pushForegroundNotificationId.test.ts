import { describe, expect, it } from "vitest";
import { notificationIdForForegroundPayload } from "../pushForegroundNotificationId";

describe("notificationIdForForegroundPayload", () => {
  it("is stable for the same chat id", () => {
    const payload = { data: { chat_id: "chat-abc", dispatch_id: "dispatch-1" } };
    expect(notificationIdForForegroundPayload(payload)).toBe(
      notificationIdForForegroundPayload({
        data: { chat_id: "chat-abc", dispatch_id: "dispatch-2" },
      }),
    );
  });

  it("differs for different chat ids", () => {
    const a = notificationIdForForegroundPayload({ data: { chat_id: "chat-a" } });
    const b = notificationIdForForegroundPayload({ data: { chat_id: "chat-b" } });
    expect(a).not.toBe(b);
  });

  it("falls back to dispatch id when chat id is absent", () => {
    const a = notificationIdForForegroundPayload({ data: { dispatch_id: "a" } });
    const b = notificationIdForForegroundPayload({ data: { dispatch_id: "b" } });
    expect(a).not.toBe(b);
  });
});
