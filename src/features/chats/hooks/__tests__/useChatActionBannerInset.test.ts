// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatActionBannerInset } from "../useChatActionBannerInset";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  disconnect() {
    this.observed = [];
  }

  unobserve() {}
}

describe("useChatActionBannerInset", () => {
  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns zero when the overlay is disabled", () => {
    const overlayRef = createRef<HTMLDivElement>();
    overlayRef.current = document.createElement("div");
    vi.spyOn(overlayRef.current, "getBoundingClientRect").mockReturnValue({
      height: 64,
    } as DOMRect);

    const { result } = renderHook(() => useChatActionBannerInset(overlayRef, false));

    expect(result.current).toBe(0);
  });

  it("measures overlay height plus gap when enabled", () => {
    const overlayRef = createRef<HTMLDivElement>();
    overlayRef.current = document.createElement("div");
    vi.spyOn(overlayRef.current, "getBoundingClientRect").mockReturnValue({
      height: 64.2,
    } as DOMRect);

    const { result } = renderHook(() => useChatActionBannerInset(overlayRef, true));

    expect(result.current).toBe(73);
    expect(ResizeObserverMock.instances[0]?.observed).toContain(overlayRef.current);
  });

  it("updates inset when ResizeObserver fires", () => {
    const overlayRef = createRef<HTMLDivElement>();
    overlayRef.current = document.createElement("div");
    const rect = vi
      .spyOn(overlayRef.current, "getBoundingClientRect")
      .mockReturnValue({ height: 40 } as DOMRect);

    const { result } = renderHook(() => useChatActionBannerInset(overlayRef, true));
    expect(result.current).toBe(48);

    rect.mockReturnValue({ height: 80 } as DOMRect);
    act(() => {
      ResizeObserverMock.instances[0]?.callback([], {} as ResizeObserver);
    });

    expect(result.current).toBe(88);
  });
});
