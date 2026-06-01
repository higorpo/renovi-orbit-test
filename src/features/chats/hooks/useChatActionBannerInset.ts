import { useLayoutEffect, useState, type RefObject } from "react";

const BANNER_CONTENT_GAP_PX = 8;

/**
 * Measures the overlaid action banner shell height for timeline top inset / scroll padding.
 */
export function useChatActionBannerInset(
  overlayRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): number {
  const [insetPx, setInsetPx] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      setInsetPx(0);
      return;
    }

    const element = overlayRef.current;
    if (!element) return;

    const measure = () => {
      const height = element.getBoundingClientRect().height;
      setInsetPx(height > 0 ? Math.ceil(height) + BANNER_CONTENT_GAP_PX : 0);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [enabled, overlayRef]);

  return insetPx;
}
