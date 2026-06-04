// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useChatTimelineStickToBottomOnResize } from "../useChatTimelineStickToBottomOnResize";

describe("useChatTimelineStickToBottomOnResize", () => {
  let resizeCallback: (() => void) | null = null;

  beforeEach(() => {
    resizeCallback = null;
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function MockResizeObserver(this: ResizeObserver, callback: ResizeObserverCallback) {
        resizeCallback = () => callback([], this);
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }),
    );
  });

  const baseParams = {
    lastTimelineMessageKey: "msg-1",
    lastMessageId: "msg-1",
    initialScrollDone: true,
    enabled: true,
  };

  it("scrolls again when the last row resizes while stick-to-bottom is active", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 900, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result } = renderHook(() =>
      useChatTimelineStickToBottomOnResize({
        scrollRef,
        ...baseParams,
        scrollToLatest,
      }),
    );

    act(() => {
      result.current.markStickToBottom();
    });

    expect(scrollToLatest).not.toHaveBeenCalled();

    act(() => {
      resizeCallback?.();
    });

    expect(scrollToLatest).toHaveBeenCalledWith("auto");
  });

  it("does not scroll on resize after the user scrolls up", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 900, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result } = renderHook(() =>
      useChatTimelineStickToBottomOnResize({
        scrollRef,
        ...baseParams,
        scrollToLatest,
      }),
    );

    act(() => {
      result.current.markStickToBottom();
      Object.defineProperty(scrollEl, "scrollTop", { value: 0, configurable: true });
      result.current.clearStickToBottomIfScrolledUp();
      resizeCallback?.();
    });

    expect(scrollToLatest).not.toHaveBeenCalled();
  });

  it("keeps stick-to-bottom when content grows below the viewport without user scroll-up", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 900, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result } = renderHook(() =>
      useChatTimelineStickToBottomOnResize({
        scrollRef,
        ...baseParams,
        scrollToLatest,
      }),
    );

    act(() => {
      result.current.markStickToBottom();
      Object.defineProperty(scrollEl, "scrollHeight", { value: 1500, configurable: true });
      result.current.clearStickToBottomIfScrolledUp();
    });

    act(() => {
      resizeCallback?.();
    });

    expect(scrollToLatest).toHaveBeenCalled();
  });

  it("scrolls when a new tail message id arrives while following the bottom", () => {
    const scrollEl = document.createElement("div");
    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result, rerender } = renderHook(
      (props: { lastMessageId: string }) =>
        useChatTimelineStickToBottomOnResize({
          scrollRef,
          ...baseParams,
          lastMessageId: props.lastMessageId,
          scrollToLatest,
        }),
      { initialProps: { lastMessageId: "msg-1" } },
    );

    act(() => {
      result.current.markStickToBottom();
    });

    scrollToLatest.mockClear();

    rerender({ lastMessageId: "msg-2" });

    expect(scrollToLatest).toHaveBeenCalledWith("auto");
  });

  it("scrolls when a new tail message arrives while near the bottom without stick-to-bottom flag", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 400, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { rerender } = renderHook(
      (props: { lastMessageId: string }) =>
        useChatTimelineStickToBottomOnResize({
          scrollRef,
          ...baseParams,
          lastMessageId: props.lastMessageId,
          scrollToLatest,
        }),
      { initialProps: { lastMessageId: "msg-1" } },
    );

    rerender({ lastMessageId: "msg-2" });

    expect(scrollToLatest).toHaveBeenCalledWith("auto");
  });

  it("does not scroll when a new tail message arrives while scrolled far from the bottom", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 500, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 200, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { rerender } = renderHook(
      (props: { lastMessageId: string }) =>
        useChatTimelineStickToBottomOnResize({
          scrollRef,
          ...baseParams,
          lastMessageId: props.lastMessageId,
          scrollToLatest,
        }),
      { initialProps: { lastMessageId: "msg-1" } },
    );

    rerender({ lastMessageId: "msg-2" });

    expect(scrollToLatest).not.toHaveBeenCalled();
  });

  it("re-enables stick-to-bottom when the user scrolls back near the bottom", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollEl, "scrollTop", { value: 900, configurable: true });
    Object.defineProperty(scrollEl, "clientHeight", { value: 100, configurable: true });

    const lastRow = document.createElement("div");
    lastRow.setAttribute("data-chat-timeline-last", "true");
    scrollEl.appendChild(lastRow);

    const scrollRef = { current: scrollEl };
    const scrollToLatest = vi.fn();

    const { result } = renderHook(() =>
      useChatTimelineStickToBottomOnResize({
        scrollRef,
        ...baseParams,
        scrollToLatest,
      }),
    );

    act(() => {
      result.current.markStickToBottom();
      Object.defineProperty(scrollEl, "scrollTop", { value: 0, configurable: true });
      result.current.clearStickToBottomIfScrolledUp();
    });

    scrollToLatest.mockClear();

    act(() => {
      Object.defineProperty(scrollEl, "scrollTop", { value: 900, configurable: true });
      result.current.clearStickToBottomIfScrolledUp();
      resizeCallback?.();
    });

    expect(scrollToLatest).toHaveBeenCalledWith("auto");
  });
});
