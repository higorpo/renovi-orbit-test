// @vitest-environment happy-dom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { setTag, setContext } = vi.hoisted(() => ({
  setTag: vi.fn(),
  setContext: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  isSentryEnabled: () => true,
  Sentry: {
    setTag,
    setContext,
  },
}));

import { clearChatSentryContext, useChatSentryContext } from "../useChatSentryContext";

describe("useChatSentryContext", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearChatSentryContext();
  });

  it("sets chats feature tags and context while mounted", () => {
    renderHook(() =>
      useChatSentryContext({
        chatId: "chat-1",
        serviceRequestId: "sr-1",
      }),
    );

    expect(setTag).toHaveBeenCalledWith("feature", "chats");
    expect(setTag).toHaveBeenCalledWith("chat_id", "chat-1");
    expect(setTag).toHaveBeenCalledWith("service_request_id", "sr-1");
    expect(setContext).toHaveBeenCalledWith("chat", {
      chat_id: "chat-1",
      service_request_id: "sr-1",
    });
  });

  it("clears chat context on unmount", () => {
    const { unmount } = renderHook(() =>
      useChatSentryContext({
        chatId: "chat-1",
        serviceRequestId: "sr-1",
      }),
    );

    unmount();

    expect(setTag).toHaveBeenCalledWith("feature", undefined);
    expect(setTag).toHaveBeenCalledWith("chat_id", undefined);
    expect(setTag).toHaveBeenCalledWith("service_request_id", undefined);
    expect(setContext).toHaveBeenCalledWith("chat", null);
  });
});
