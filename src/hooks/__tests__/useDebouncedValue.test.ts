// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedState, useDebouncedValue } from "../useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("initial", 300));

    expect(result.current).toBe("initial");
  });

  it("updates only after the configured delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "first" } },
    );

    rerender({ value: "second" });
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("first");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("second");
  });

  it("restarts the delay when the value changes again", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: "first" } },
    );

    rerender({ value: "second" });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: "third" });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("first");

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe("third");
  });
});

describe("useDebouncedState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates the current value immediately and the readable value after the delay", () => {
    const { result } = renderHook(() => useDebouncedState("initial", 250));

    act(() => result.current[2]("updated"));

    expect(result.current[0]).toBe("updated");
    expect(result.current[1]).toBe("initial");

    act(() => vi.advanceTimersByTime(250));
    expect(result.current[1]).toBe("updated");
  });
});
