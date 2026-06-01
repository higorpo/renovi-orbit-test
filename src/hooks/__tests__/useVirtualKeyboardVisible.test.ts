// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from "vitest";
import { readKeyboardVisible } from "../useVirtualKeyboardVisible";

describe("useVirtualKeyboardVisible", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--keyboard-height");
  });

  it("readKeyboardVisible is true when --keyboard-height is set", () => {
    document.documentElement.style.setProperty("--keyboard-height", "280px");
    expect(readKeyboardVisible()).toBe(true);
  });

  it("readKeyboardVisible is false when --keyboard-height is absent and viewport is full height", () => {
    document.documentElement.style.removeProperty("--keyboard-height");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 800, offsetTop: 0 },
    });
    expect(readKeyboardVisible()).toBe(false);
  });
});
