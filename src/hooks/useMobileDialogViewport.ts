import { useCallback, useLayoutEffect, useRef } from "react";

const SM_BREAKPOINT = "(max-width: 639px)";

/**
 * Keeps a full-screen mobile dialog sized to the visual viewport so the
 * footer stays visible above the virtual keyboard. Returns a ref to attach
 * to the dialog content element and a `scheduleSync` callback that can be
 * called on input focus to handle keyboard animation lag.
 *
 * On viewports >= 640px (sm) the hook is a no-op — all inline styles are
 * removed so normal dialog positioning applies.
 */
export function useMobileDialogViewport(open: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);

  const sync = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const isMobile = window.matchMedia(SM_BREAKPOINT).matches;
    if (!isMobile || !window.visualViewport) {
      el.style.removeProperty("height");
      el.style.removeProperty("top");
      el.style.removeProperty("max-height");
      el.style.removeProperty("bottom");
      return;
    }

    const vv = window.visualViewport;
    el.style.height = `${vv.height}px`;
    el.style.maxHeight = `${vv.height}px`;
    el.style.top = `${vv.offsetTop}px`;
    el.style.bottom = "auto";
  }, []);

  const scheduleSync = useCallback(() => {
    sync();
    window.setTimeout(sync, 50);
    window.setTimeout(sync, 150);
    window.setTimeout(sync, 320);
  }, [sync]);

  useLayoutEffect(() => {
    if (!open) return;

    sync();
    requestAnimationFrame(() => {
      sync();
      requestAnimationFrame(sync);
    });

    const el = contentRef.current;
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (el) {
        el.style.removeProperty("height");
        el.style.removeProperty("top");
        el.style.removeProperty("max-height");
        el.style.removeProperty("bottom");
      }
    };
  }, [open, sync]);

  return { contentRef, scheduleSync } as const;
}
