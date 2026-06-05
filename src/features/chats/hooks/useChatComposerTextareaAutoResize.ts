import { useLayoutEffect, type RefObject } from "react";
import { resizeTextareaToContent } from "../utils/chatComposerTextareaResize";

export function useChatComposerTextareaAutoResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    resizeTextareaToContent(textarea);
  }, [textareaRef, value]);
}
