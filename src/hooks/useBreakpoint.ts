import { useSyncExternalStore } from "react";

const MEDIUM_BREAKPOINT_PX = 768;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(min-width: ${MEDIUM_BREAKPOINT_PX}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(`(min-width: ${MEDIUM_BREAKPOINT_PX}px)`).matches;
}

function getServerSnapshot() {
  return true;
}

/**
 * True when viewport is at least 768px (md), false for smaller (mobile).
 * Use for desktop vs mobile layout (e.g. top nav vs bottom nav + hamburger).
 */
export function useBreakpointMd(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
