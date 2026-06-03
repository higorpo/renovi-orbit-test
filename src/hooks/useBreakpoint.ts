import { useMediaQuery } from "./useMediaQuery";

const MEDIUM_BREAKPOINT_PX = 768;
const MD_MEDIA_QUERY = `(min-width: ${MEDIUM_BREAKPOINT_PX}px)`;

/**
 * True when viewport is at least 768px (md), false for smaller (mobile).
 * Use for desktop vs mobile layout (e.g. top nav vs bottom nav + hamburger).
 */
export function useBreakpointMd(): boolean {
  return useMediaQuery(MD_MEDIA_QUERY);
}
