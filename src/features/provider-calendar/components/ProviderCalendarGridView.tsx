import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduledServiceItem } from "../types/provider-calendar.types";
import type { UseProviderCalendarMonthResult } from "../hooks/useProviderCalendarMonth";
import { parseIsoDate, todayIso } from "../utils/calendarDateUtils";
import {
  getSingleDayServicesForCell,
  layoutWeekBars,
} from "../utils/layoutWeekBars";
import { CalendarMultiDayBar } from "./CalendarMultiDayBar";
import { CalendarServiceChip } from "./CalendarServiceChip";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MULTI_DAY_BAR_HEIGHT_PX = 46;
const MULTI_DAY_BAR_GAP_PX = 6;
/** pt-2 + h-7 + pb-3 — height of the day-number block before the event band. */
const DAY_NUMBER_BLOCK_PX = 48;

export interface ProviderCalendarGridViewProps {
  month: UseProviderCalendarMonthResult;
  onOpenService: (service: ScheduledServiceItem) => void;
}

function getWeekMultiDayBars(weekDates: string[], services: ScheduledServiceItem[]) {
  return layoutWeekBars(weekDates, services).filter(
    (bar) => bar.span > 1 || bar.continuesFromPreviousWeek || bar.continuesIntoNextWeek,
  );
}

function getMultiDayBandHeight(laneCount: number): number {
  if (laneCount <= 0) return 0;
  return laneCount * MULTI_DAY_BAR_HEIGHT_PX + (laneCount - 1) * MULTI_DAY_BAR_GAP_PX + 12;
}

export function ProviderCalendarGridView({ month, onOpenService }: ProviderCalendarGridViewProps) {
  const today = todayIso();
  const monthStart = `${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}-01`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Agenda mensal
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{month.monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={month.goToPreviousMonth}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-3"
            onClick={month.goToToday}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={month.goToNextMonth}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>

        <div>
          {month.weeks.map((weekDates) => {
            const bars = getWeekMultiDayBars(weekDates, month.services);
            const laneCount =
              bars.length > 0 ? bars.reduce((max, bar) => Math.max(max, bar.lane), -1) + 1 : 0;
            const multiDayBandHeight = getMultiDayBandHeight(laneCount);

            return (
              <div
                key={weekDates.join("-")}
                className="relative grid grid-cols-7 divide-x divide-border/60 border-b border-border/70 last:border-b-0"
              >
                {weekDates.map((date) => {
                  const parsed = parseIsoDate(date);
                  const inMonth = date.slice(0, 7) === monthStart.slice(0, 7);
                  const isToday = date === today;
                  const singleDayServices = getSingleDayServicesForCell(date, month.services);

                  return (
                    <div
                      key={date}
                      className={cn(
                        "flex min-h-[108px] flex-col",
                        !inMonth && "bg-muted/15 text-muted-foreground",
                      )}
                    >
                      <div className="flex shrink-0 px-2 pt-2 pb-3">
                        <span
                          className={cn(
                            "inline-flex h-7 min-w-7 items-center justify-center rounded-full text-sm font-semibold",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {parsed?.getDate()}
                        </span>
                      </div>

                      {multiDayBandHeight > 0 ? (
                        <div
                          className="shrink-0"
                          style={{ height: multiDayBandHeight }}
                          aria-hidden
                        />
                      ) : null}

                      <div className="flex flex-1 flex-col gap-1 px-2 pb-2 pt-1">
                        {singleDayServices.slice(0, 2).map((service) => (
                          <CalendarServiceChip
                            key={service.contractedServiceId}
                            item={{ service, spanPosition: "single" }}
                            onOpen={() => onOpenService(service)}
                            compact
                          />
                        ))}
                        {singleDayServices.length > 2 ? (
                          <p className="px-1 text-[11px] font-medium text-muted-foreground">
                            +{singleDayServices.length - 2} serviços
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {bars.length > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-y-1.5 px-2"
                    style={{
                      top: DAY_NUMBER_BLOCK_PX,
                      height: multiDayBandHeight,
                      gridAutoRows: `${MULTI_DAY_BAR_HEIGHT_PX}px`,
                    }}
                  >
                    {bars.map((bar) => (
                      <CalendarMultiDayBar
                        key={`${bar.service.contractedServiceId}-${weekDates[0]}`}
                        bar={bar}
                        onOpen={() => onOpenService(bar.service)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
