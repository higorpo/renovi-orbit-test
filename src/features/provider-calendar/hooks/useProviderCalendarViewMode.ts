import { useBreakpointMd } from "@/hooks/useBreakpoint";
import type { CalendarViewMode } from "../types/provider-calendar.types";

export function useProviderCalendarViewMode() {
  const isDesktop = useBreakpointMd();
  const viewMode: CalendarViewMode = isDesktop ? "grid" : "list";

  return { viewMode, isDesktop };
}
