// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { useChatImageDisplay } from "../useChatImageDisplay";
import {
  clearAllImagePreviewHoldoversForTests,
  registerImagePreviewHoldover,
} from "../../utils/chatImagePreviewHoldover";
import {
  clearChatImageSignedUrlCacheForTests,
  setCachedChatImageDisplayUrls,
  buildChatImageDisplayCacheKey,
} from "../../utils/chatImageSignedUrlCache";

const resolveChatImageDisplayUrlsMock = vi.fn();
const preloadImageUrlsMock = vi.fn(async () => true);

vi.mock("../../api/chatMedia.api", () => ({
  resolveChatImageDisplayUrls: (...args: unknown[]) =>
    resolveChatImageDisplayUrlsMock(...args),
}));

vi.mock("../../utils/preloadImageUrls", () => ({
  preloadImageUrls: (...args: unknown[]) => preloadImageUrlsMock(...args),
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

  it("prefers local preview urls and skips network resolve", async () => {
    const message: ChatMessageListItem = {
      ...baseMessage,
      payload: {
        local_preview_urls: ["blob:local"],
        paths: ["chat/s/a.png"],
        preview: "Local",
      },
    };

    const { result } = renderHook(() => useChatImageDisplay(message));

    expect(result.current.urls).toEqual(["blob:local"]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pathCount).toBe(1);
    expect(result.current.caption).toBe("Local");
    expect(resolveChatImageDisplayUrlsMock).not.toHaveBeenCalled();
  });

  it("clears urls when there are no paths and no local previews", () => {
    const message: ChatMessageListItem = {
      ...baseMessage,
      payload: { preview: "empty", paths: [] },
    };

    const { result } = renderHook(() => useChatImageDisplay(message));

    expect(result.current.urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(result.current.pathCount).toBe(0);
    expect(resolveChatImageDisplayUrlsMock).not.toHaveBeenCalled();
  });

  it("uses cached signed urls without refetching", () => {
    const cacheKey = buildChatImageDisplayCacheKey(baseMessage.id, ["chat/s/a.png"]);
    setCachedChatImageDisplayUrls(cacheKey, ["https://cdn.example.com/cached.png"]);
    registerImagePreviewHoldover("idem-1", ["blob:stale"]);

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    expect(result.current.urls).toEqual(["https://cdn.example.com/cached.png"]);
    expect(result.current.isLoading).toBe(false);
    expect(resolveChatImageDisplayUrlsMock).not.toHaveBeenCalled();
  });

  it("sets hasError when resolve fails without holdover", async () => {
    resolveChatImageDisplayUrlsMock.mockResolvedValue({
      urls: [],
      error: { code: "UNKNOWN", message: "fail" },
    });

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps holdover urls when resolve fails", async () => {
    registerImagePreviewHoldover("idem-1", ["blob:keep"]);
    resolveChatImageDisplayUrlsMock.mockResolvedValue({
      urls: [],
      error: { code: "UNKNOWN", message: "fail" },
    });

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["blob:keep"]);
    expect(result.current.hasError).toBe(false);
  });

  it("starts loading when paths exist without cache or holdover", async () => {
    let resolveSigned!: (value: { urls: string[]; error: null }) => void;
    resolveChatImageDisplayUrlsMock.mockReturnValue(
      new Promise<{ urls: string[]; error: null }>((resolve) => {
        resolveSigned = resolve;
      }),
    );

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.urls).toEqual([]);

    await act(async () => {
      resolveSigned({ urls: ["https://cdn.example.com/a.png"], error: null });
    });

    await waitFor(() =>
      expect(result.current.urls).toEqual(["https://cdn.example.com/a.png"]),
    );
    expect(preloadImageUrlsMock).toHaveBeenCalled();
    expect(result.current.pathCount).toBe(1);
  });

  it("ignores late resolve after unmount", async () => {
    let resolveSigned!: (value: { urls: string[]; error: null }) => void;
    resolveChatImageDisplayUrlsMock.mockReturnValue(
      new Promise<{ urls: string[]; error: null }>((resolve) => {
        resolveSigned = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useChatImageDisplay(baseMessage));
    expect(result.current.isLoading).toBe(true);
    unmount();

    await act(async () => {
      resolveSigned({ urls: ["https://cdn.example.com/late.png"], error: null });
    });

    expect(preloadImageUrlsMock).not.toHaveBeenCalled();
  });

  it("uses urls length for pathCount when paths and local previews are empty", () => {
    const message: ChatMessageListItem = {
      ...baseMessage,
      payload: { preview: "x", paths: [] },
    };
    const { result } = renderHook(() => useChatImageDisplay(message));
    expect(result.current.pathCount).toBe(0);
  });

  it("sets hasError when resolve returns empty urls without error", async () => {
    resolveChatImageDisplayUrlsMock.mockResolvedValue({
      urls: [],
      error: null,
    });

    const { result } = renderHook(() => useChatImageDisplay(baseMessage));

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("uses paths length for pathCount with multiple storage paths", async () => {
    resolveChatImageDisplayUrlsMock.mockResolvedValue({
      urls: ["https://cdn.example.com/a.png", "https://cdn.example.com/b.png"],
      error: null,
    });

    const message: ChatMessageListItem = {
      ...baseMessage,
      payload: {
        paths: ["chat/s/a.png", "chat/s/b.png"],
        preview: "2 fotos",
      },
    };

    const { result } = renderHook(() => useChatImageDisplay(message));

    await waitFor(() =>
      expect(result.current.urls).toEqual([
        "https://cdn.example.com/a.png",
        "https://cdn.example.com/b.png",
      ]),
    );
    expect(result.current.pathCount).toBe(2);
  });

  it("re-resolves when message paths change", async () => {
    resolveChatImageDisplayUrlsMock
      .mockResolvedValueOnce({
        urls: ["https://cdn.example.com/a.png"],
        error: null,
      })
      .mockResolvedValueOnce({
        urls: ["https://cdn.example.com/b.png"],
        error: null,
      });

    const { result, rerender } = renderHook(
      ({ message }: { message: ChatMessageListItem }) => useChatImageDisplay(message),
      { initialProps: { message: baseMessage } },
    );

    await waitFor(() =>
      expect(result.current.urls).toEqual(["https://cdn.example.com/a.png"]),
    );

    rerender({
      message: {
        ...baseMessage,
        payload: { paths: ["chat/s/b.png"], preview: "Foto" },
      },
    });

    await waitFor(() =>
      expect(result.current.urls).toEqual(["https://cdn.example.com/b.png"]),
    );
    expect(resolveChatImageDisplayUrlsMock).toHaveBeenCalledTimes(2);
  });

  it("ignores late resolve after preload when unmounted mid-preload", async () => {
    let resolvePreload!: () => void;
    preloadImageUrlsMock.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolvePreload = () => resolve(true);
      }),
    );
    resolveChatImageDisplayUrlsMock.mockResolvedValue({
      urls: ["https://cdn.example.com/late.png"],
      error: null,
    });

    const { result, unmount } = renderHook(() => useChatImageDisplay(baseMessage));
    await waitFor(() => expect(preloadImageUrlsMock).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
    unmount();

    await act(async () => {
      resolvePreload();
    });
  });
});
