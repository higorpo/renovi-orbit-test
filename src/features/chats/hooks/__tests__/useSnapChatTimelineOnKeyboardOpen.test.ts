// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSnapChatTimelineOnKeyboardOpen } from "../useSnapChatTimelineOnKeyboardOpen";

vi.mock("@/hooks/useVirtualKeyboardVisible", () => ({
  useVirtualKeyboardVisible: vi.fn(() => false),
}));

const useVirtualKeyboardVisible = vi.mocked(
  await import("@/hooks/useVirtualKeyboardVisible").then((m) => m.useVirtualKeyboardVisible),
);

describe("useSnapChatTimelineOnKeyboardOpen", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--keyboard-height");
    useVirtualKeyboardVisible.mockReturnValue(false);
  });

  it("scrolls to latest when keyboard opens and user was anchored near bottom", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 350, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result, rerender } = renderHook(() =>
      useSnapChatTimelineOnKeyboardOpen({
        scrollRef,
        scrollToLatest,
        enabled: true,
      }),
    );

    act(() => {
      result.current.anchorBeforeKeyboard();
    });

    useVirtualKeyboardVisible.mockReturnValue(true);
    rerender();

    expect(scrollToLatest).toHaveBeenCalled();
  });

  it("does not scroll when user was not near bottom before focus", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 0, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result, rerender } = renderHook(() =>
      useSnapChatTimelineOnKeyboardOpen({
        scrollRef,
        scrollToLatest,
        enabled: true,
      }),
    );

    act(() => {
      result.current.anchorBeforeKeyboard();
    });

    useVirtualKeyboardVisible.mockReturnValue(true);
    rerender();

    expect(scrollToLatest).not.toHaveBeenCalled();
  });
});
