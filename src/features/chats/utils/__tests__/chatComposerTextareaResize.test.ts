// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  CHAT_COMPOSER_MAX_TEXTAREA_LINES,
  getTextareaMaxHeightPx,
  resizeTextareaToContent,
} from "../chatComposerTextareaResize";

function createTextarea(scrollHeight: number) {
  const textarea = document.createElement("textarea");
  textarea.style.fontSize = "15px";
  textarea.style.lineHeight = "20.625px";
  textarea.style.paddingTop = "12px";
  textarea.style.paddingBottom = "12px";
  document.body.appendChild(textarea);

  Object.defineProperty(textarea, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });

  return textarea;
}

describe("chatComposerTextareaResize", () => {
  it("caps max height at five lines of computed line-height", () => {
    const textarea = createTextarea(40);

    const maxHeight = getTextareaMaxHeightPx(textarea, CHAT_COMPOSER_MAX_TEXTAREA_LINES);
    const styles = getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const paddingTop = Number.parseFloat(styles.paddingTop);
    const paddingBottom = Number.parseFloat(styles.paddingBottom);

    expect(maxHeight).toBe(lineHeight * 5 + paddingTop + paddingBottom);
    textarea.remove();
  });

  it("grows with content until the max height is reached", () => {
    const textarea = createTextarea(72);

    resizeTextareaToContent(textarea);

    expect(textarea.style.height).toBe("72px");
    expect(textarea.style.overflowY).toBe("hidden");
    textarea.remove();
  });

  it("enables vertical scroll after five lines", () => {
    const textarea = createTextarea(220);

    resizeTextareaToContent(textarea);

    const maxHeight = getTextareaMaxHeightPx(textarea);
    expect(textarea.style.height).toBe(`${maxHeight}px`);
    expect(textarea.style.overflowY).toBe("auto");
    textarea.remove();
  });

  it("shrinks back down when content is cleared", () => {
    const textarea = createTextarea(120);
    resizeTextareaToContent(textarea);

    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => 44,
    });
    resizeTextareaToContent(textarea);

    expect(textarea.style.height).toBe("44px");
    expect(textarea.style.overflowY).toBe("hidden");
    textarea.remove();
  });
});
