export const CHAT_COMPOSER_MAX_TEXTAREA_LINES = 5;

function getLineHeightPx(textarea: HTMLTextAreaElement): number {
  const styles = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight);
  if (Number.isFinite(lineHeight)) {
    return lineHeight;
  }

  const fontSize = Number.parseFloat(styles.fontSize);
  if (Number.isFinite(fontSize)) {
    return fontSize * 1.375;
  }

  return 20;
}

export function getTextareaMaxHeightPx(
  textarea: HTMLTextAreaElement,
  maxLines: number = CHAT_COMPOSER_MAX_TEXTAREA_LINES,
): number {
  const styles = getComputedStyle(textarea);
  const lineHeight = getLineHeightPx(textarea);
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;

  return (
    lineHeight * maxLines + paddingTop + paddingBottom + borderTop + borderBottom
  );
}

export function resizeTextareaToContent(
  textarea: HTMLTextAreaElement,
  maxLines: number = CHAT_COMPOSER_MAX_TEXTAREA_LINES,
): void {
  textarea.style.height = "auto";

  const maxHeight = getTextareaMaxHeightPx(textarea, maxLines);
  const contentHeight = textarea.scrollHeight;
  const nextHeight = Math.min(contentHeight, maxHeight);

  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
}
