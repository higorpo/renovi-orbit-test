import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ScheduledServiceItem } from "../types/provider-calendar.types";
import type { UseProviderCalendarListResult } from "../hooks/useProviderCalendarList";
import { CalendarListDaySection } from "./CalendarListDaySection";

export interface ProviderCalendarListViewProps {
  list: UseProviderCalendarListResult;
  onOpenService: (service: ScheduledServiceItem) => void;
}

export function ProviderCalendarListView({ list, onOpenService }: ProviderCalendarListViewProps) {
  const hasScrolledToTodayRef = useRef(false);

  useEffect(() => {
    if (list.isLoading || hasScrolledToTodayRef.current) return;
    const todaySection = document.querySelector(`[data-date="${list.today}"]`);
    if (!(todaySection instanceof HTMLElement)) return;

    const main = todaySection.closest("main");
    if (main instanceof HTMLElement) {
      const mainTop = main.getBoundingClientRect().top;
      const sectionTop = todaySection.getBoundingClientRect().top;
      main.scrollTop += sectionTop - mainTop - 8;
    } else {
      todaySection.scrollIntoView({ block: "start" });
    }

    hasScrolledToTodayRef.current = true;
  }, [list.isLoading, list.today]);

  return (
    <div className="relative">
      <div ref={list.topSentinelRef} className="h-px" aria-hidden />
      {list.isLoadingBackward ? (
        <div className="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando dias anteriores…
        </div>
      ) : null}

      <div className="space-y-2">
        {list.days.map((entry) => (
          <CalendarListDaySection
            key={entry.date}
            entry={entry}
            today={list.today}
            onOpenService={(serviceRequestId) => {
              const service = entry.services.find(
                (item) => item.service.serviceRequestId === serviceRequestId,
              )?.service;
              if (service) onOpenService(service);
            }}
          />
        ))}
      </div>

      {list.isFetchingNextPage ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando próximos dias…
        </div>
      ) : null}
      <div ref={list.bottomSentinelRef} className="h-px" aria-hidden />
    </div>
  );
}
