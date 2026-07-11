// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatTimelinePrependScroll } from "../useChatTimelinePrependScroll";

describe("useChatTimelinePrependScroll", () => {
  const animationFrames: FrameRequestCallback[] = [];

  beforeEach(() => {
    animationFrames.length = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores scrollTop after older messages finish loading", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", {
      configurable: true,
      get: () => (scrollEl.dataset.height === "after" ? 1600 : 1000),
    });
    scrollEl.scrollTop = 120;
    scrollRef.current = scrollEl;

    const { rerender } = renderHook(
      ({
        isFetchingNextPage,
        contentItemCount,
      }: {
        isFetchingNextPage: boolean;
        contentItemCount: number;
      }) => useChatTimelinePrependScroll(scrollRef, isFetchingNextPage, contentItemCount),
      { initialProps: { isFetchingNextPage: false, contentItemCount: 10 } },
    );

    rerender({ isFetchingNextPage: true, contentItemCount: 10 });
    expect(scrollEl.scrollTop).toBe(120);

    scrollEl.dataset.height = "after";
    rerender({ isFetchingNextPage: false, contentItemCount: 20 });

    act(() => {
      animationFrames[0]?.(0);
      animationFrames[1]?.(0);
    });

    expect(scrollEl.scrollTop).toBe(720);
  });

  it("does not adjust scroll when fetch never started", () => {
    const scrollRef = createRef<HTMLDivElement>();
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", {
      configurable: true,
      get: () => 1000,
    });
    scrollEl.scrollTop = 50;
    scrollRef.current = scrollEl;

    const { rerender } = renderHook(
      ({ contentItemCount }: { contentItemCount: number }) =>
        useChatTimelinePrependScroll(scrollRef, false, contentItemCount),
      { initialProps: { contentItemCount: 5 } },
    );

    rerender({ contentItemCount: 8 });

    expect(animationFrames).toHaveLength(0);
    expect(scrollEl.scrollTop).toBe(50);
  });
});
