import { describe, expect, it } from "vitest";
import { notificationIdForForegroundPayload } from "../pushForegroundNotificationId";

describe("notificationIdForForegroundPayload", () => {
  it("is stable for the same dispatch id", () => {
    const payload = { data: { dispatch_id: "dispatch-abc" } };
    expect(notificationIdForForegroundPayload(payload)).toBe(
      notificationIdForForegroundPayload(payload),
    );
  });

  it("differs for different dispatch ids", () => {
    const a = notificationIdForForegroundPayload({ data: { dispatch_id: "a" } });
    const b = notificationIdForForegroundPayload({ data: { dispatch_id: "b" } });
    expect(a).not.toBe(b);
  });
});
