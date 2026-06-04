// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { useChatImageDisplay } from "../useChatImageDisplay";
import {
  clearAllImagePreviewHoldoversForTests,
  registerImagePreviewHoldover,
} from "../../utils/chatImagePreviewHoldover";
import { clearChatImageSignedUrlCacheForTests } from "../../utils/chatImageSignedUrlCache";

const resolveChatImageDisplayUrlsMock = vi.fn();

vi.mock("../../api/chatMedia.api", () => ({
  resolveChatImageDisplayUrls: (...args: unknown[]) =>
    resolveChatImageDisplayUrlsMock(...args),
}));

vi.mock("../../utils/preloadImageUrls", () => ({
  preloadImageUrls: vi.fn(async () => true),
}));

const baseMessage: ChatMessageListItem = {
  id: "msg-1",
  chat_id: "chat-1",
  sender_user_id: "user-1",
  message_type: "IMAGE",
  payload: {
    paths: ["chat/s/a.png"],
    preview: "Foto",
  },
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "idem-1",
  delivery_status: "SENT",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
  clearChatImageSignedUrlCacheForTests();
  clearAllImagePreviewHoldoversForTests();
});

describe("useChatImageDisplay", () => {
  it("keeps holdover visible while signed URLs resolve", async () => {
    registerImagePreviewHoldover("idem-1", ["blob:preview"]);

    let resolveSigned!: (value: { urls: string[]; error: null }) => void;
    resolveChatImageDisplayUrlsMock.mockReturnValue(
      new Promise<{ urls: string[]; error: null }>((resolve) => {
        resolveSigned = resolve;
      }),
    );

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.urls).toEqual(["blob:preview"]);

    resolveSigned({ urls: ["https://cdn.example.com/a.png"], error: null });

    await waitFor(() =>
      expect(result.current.urls).toEqual(["https://cdn.example.com/a.png"]),
    );
    expect(result.current.isLoading).toBe(false);
  });
});
