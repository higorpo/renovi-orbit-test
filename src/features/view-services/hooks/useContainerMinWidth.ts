import { useEffect, useState, type RefObject } from "react";

/**
 * True when the element's content box is at least `minWidthPx`.
 * Used for Detail–Action Split (page vs sheet container width).
 */
export function useContainerMinWidth(
  ref: RefObject<HTMLElement | null>,
  minWidthPx: number,
): boolean {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setIsWide(element.getBoundingClientRect().width >= minWidthPx);
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (typeof width === "number") {
        setIsWide(width >= minWidthPx);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minWidthPx]);

  return isWide;
}
