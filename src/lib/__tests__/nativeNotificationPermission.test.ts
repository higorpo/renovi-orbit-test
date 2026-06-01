import { describe, expect, it } from "vitest";
import { normalizeNativeNotificationPermission } from "../nativeNotificationPermission";

describe("normalizeNativeNotificationPermission", () => {
  it("maps prompt-with-rationale to prompt", () => {
    expect(normalizeNativeNotificationPermission("prompt-with-rationale")).toBe("prompt");
  });

  it("preserves granted and denied", () => {
    expect(normalizeNativeNotificationPermission("granted")).toBe("granted");
    expect(normalizeNativeNotificationPermission("denied")).toBe("denied");
  });
});
