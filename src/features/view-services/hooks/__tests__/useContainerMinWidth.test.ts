// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useContainerMinWidth } from "../useContainerMinWidth";

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  disconnect() {
    this.observed = [];
  }

  unobserve() {}

  emit(width: number) {
    this.callback(
      [
        {
          contentRect: { width } as DOMRectReadOnly,
          target: this.observed[0] as Element,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

describe("useContainerMinWidth", () => {
  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates when the observed element crosses the threshold", () => {
    const ref = createRef<HTMLDivElement>();
    const el = document.createElement("div");
    Object.defineProperty(el, "getBoundingClientRect", {
      value: () => ({ width: 500 }),
    });
    // Attach ref before renderHook effect
    Object.defineProperty(ref, "current", { value: el, writable: true });

    const { result } = renderHook(() => useContainerMinWidth(ref, 720));
    expect(result.current).toBe(false);

    act(() => {
      ResizeObserverMock.instances[0]?.emit(800);
    });
    expect(result.current).toBe(true);

    act(() => {
      ResizeObserverMock.instances[0]?.emit(600);
    });
    expect(result.current).toBe(false);
  });
});
