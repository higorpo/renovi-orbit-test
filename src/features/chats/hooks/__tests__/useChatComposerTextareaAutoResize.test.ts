// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useChatComposerTextareaAutoResize } from "../useChatComposerTextareaAutoResize";

const resizeTextareaToContentMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/chatComposerTextareaResize", () => ({
  resizeTextareaToContent: (...args: unknown[]) => resizeTextareaToContentMock(...args),
}));

describe("useChatComposerTextareaAutoResize", () => {
  it("resizes the textarea when the draft value changes", () => {
    const textareaRef = createRef<HTMLTextAreaElement>();
    textareaRef.current = document.createElement("textarea");

    const { rerender } = renderHook(
      ({ value }) => useChatComposerTextareaAutoResize(textareaRef, value),
      { initialProps: { value: "Olá" } },
    );

    expect(resizeTextareaToContentMock).toHaveBeenCalledWith(textareaRef.current);

    resizeTextareaToContentMock.mockClear();
    rerender({ value: "Olá mundo" });

    expect(resizeTextareaToContentMock).toHaveBeenCalledWith(textareaRef.current);
  });

  it("skips resize when the textarea ref is empty", () => {
    resizeTextareaToContentMock.mockClear();
    const textareaRef = createRef<HTMLTextAreaElement>();

    renderHook(() => useChatComposerTextareaAutoResize(textareaRef, "draft"));

    expect(resizeTextareaToContentMock).not.toHaveBeenCalled();
  });
});
