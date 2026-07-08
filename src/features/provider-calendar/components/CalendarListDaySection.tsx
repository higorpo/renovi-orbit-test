import type { CalendarDayEntry } from "../types/provider-calendar.types";
import { parseIsoDate } from "@/lib/utils/calendarDate";
import {
  getDayNumberLabel,
  getMonthYearLabel,
  getWeekdayLabel,
} from "../utils/calendarDateUtils";
import { CalendarServiceChip } from "./CalendarServiceChip";

const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export interface CalendarListDaySectionProps {
  entry: CalendarDayEntry;
  today: string;
  onOpenService: (serviceRequestId: string) => void;
}

export function CalendarListDaySection({ entry, today, onOpenService }: CalendarListDaySectionProps) {
  const parsed = parseIsoDate(entry.date);
  const isToday = entry.date === today;
  const weekday = getWeekdayLabel(entry.date);
  const dayNumber = getDayNumberLabel(entry.date);
  const monthYear =
    parsed != null ? getMonthYearLabel(parsed.getFullYear(), parsed.getMonth()) : "";

  return (
    <section
      aria-label={`${weekday}, ${dayNumber}`}
      className="scroll-mt-24 border-b border-border/70 pb-6 last:border-b-0"
      data-date={entry.date}
    >
      <header className="sticky top-0 z-20 -mx-1 mb-4 border-b border-border/60 bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {monthYear}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h2
                className={
                  isToday
                    ? "text-3xl font-bold tracking-tight text-primary"
                    : "text-3xl font-bold tracking-tight text-foreground"
                }
              >
                {dayNumber}
              </h2>
              <p className="text-sm font-medium capitalize text-muted-foreground">{weekday}</p>
            </div>
          </div>
          {isToday ? (
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Hoje
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
              {WEEKDAY_SHORT[parsed?.getDay() ?? 0]}
            </span>
          )}
        </div>
      </header>

      {entry.services.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
          Nenhum serviço agendado para este dia.
        </p>
      ) : (
        <ul className="space-y-3">
          {entry.services.map(({ service, spanPosition }) => (
            <li key={`${entry.date}-${service.contractedServiceId}`}>
              <CalendarServiceChip
                item={{ service, spanPosition }}
                onOpen={() => onOpenService(service.serviceRequestId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
