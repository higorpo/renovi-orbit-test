// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  extractChatIdFromPushPayload,
  shouldSuppressChatPushNotification,
} from "../pushNotificationSuppression";

describe("pushNotificationSuppression", () => {
  it("reads chat_id from push data", () => {
    expect(
      extractChatIdFromPushPayload({
        data: { chat_id: "chat-1", dispatch_id: "d1" },
      }),
    ).toBe("chat-1");
    expect(
      extractChatIdFromPushPayload({
        data: { conversation_id: "chat-2" },
      }),
    ).toBe("chat-2");
    expect(
      extractChatIdFromPushPayload({
        data: { deep_link_path: "/dashboard/chats/chat-3" },
      }),
    ).toBe("chat-3");
  });

  it("suppresses when foreground and same active conversation", () => {
    const suppress = shouldSuppressChatPushNotification({
      activeConversationId: "chat-1",
      payload: { data: { chat_id: "chat-1" } },
      appInForeground: true,
      webTabVisible: true,
    });
    expect(suppress).toBe(true);
  });

  it("does not suppress when tab is hidden (web background)", () => {
    const suppress = shouldSuppressChatPushNotification({
      activeConversationId: "chat-1",
      payload: { data: { chat_id: "chat-1" } },
      appInForeground: true,
      webTabVisible: false,
    });
    expect(suppress).toBe(false);
  });

  it("does not suppress when viewing another chat", () => {
    const suppress = shouldSuppressChatPushNotification({
      activeConversationId: "chat-1",
      payload: { data: { chat_id: "chat-2" } },
      appInForeground: true,
      webTabVisible: true,
    });
    expect(suppress).toBe(false);
  });

  it("does not suppress when app is in background or chat id is missing", () => {
    expect(
      shouldSuppressChatPushNotification({
        activeConversationId: "chat-1",
        payload: { data: { chat_id: "chat-1" } },
        appInForeground: false,
        webTabVisible: true,
      }),
    ).toBe(false);

    expect(
      shouldSuppressChatPushNotification({
        activeConversationId: null,
        payload: { data: { chat_id: "chat-1" } },
        appInForeground: true,
        webTabVisible: true,
      }),
    ).toBe(false);

    expect(
      shouldSuppressChatPushNotification({
        activeConversationId: "chat-1",
        payload: { data: {} },
        appInForeground: true,
        webTabVisible: true,
      }),
    ).toBe(false);
  });

  it("uses document visibility when webTabVisible is omitted", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    expect(
      shouldSuppressChatPushNotification({
        activeConversationId: "chat-1",
        payload: { data: { chat_id: "chat-1" } },
        appInForeground: true,
      }),
    ).toBe(true);
  });
});

describe("isWebTabVisible", () => {
  it("returns false when document is hidden", async () => {
    const { isWebTabVisible } = await import("../pushNotificationSuppression");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    expect(isWebTabVisible()).toBe(false);
    vi.restoreAllMocks();
  });

  it("returns true when document is visible", async () => {
    const { isWebTabVisible } = await import("../pushNotificationSuppression");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    expect(isWebTabVisible()).toBe(true);
  });
});
