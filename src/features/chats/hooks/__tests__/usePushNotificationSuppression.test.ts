// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldSuppressPushNotification,
  setPushSuppressionChecker,
} from "../../../../lib/pushSuppression";
import { usePushNotificationSuppression } from "../usePushNotificationSuppression";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

beforeEach(() => {
  setPushSuppressionChecker(null);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

describe("usePushNotificationSuppression", () => {
  it("registers checker that suppresses matching chat_id", () => {
    const { unmount } = renderHook(() => usePushNotificationSuppression("chat-1"));

    expect(
      shouldSuppressPushNotification({
        data: { chat_id: "chat-1" },
      }),
    ).toBe(true);
    expect(
      shouldSuppressPushNotification({
        data: { chat_id: "chat-2" },
      }),
    ).toBe(false);

    unmount();
    setPushSuppressionChecker(null);

    expect(
      shouldSuppressPushNotification({
        data: { chat_id: "chat-1" },
      }),
    ).toBe(false);
  });
});
