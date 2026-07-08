import type { WeekEventBar } from "../types/provider-calendar.types";
import { formatShift } from "@/lib/utils/formatShift";
import { cn } from "@/lib/utils";

export interface CalendarMultiDayBarProps {
  bar: WeekEventBar;
  onOpen: () => void;
}

export function CalendarMultiDayBar({ bar, onOpen }: CalendarMultiDayBarProps) {
  const { service, startCol, span, continuesFromPreviousWeek, continuesIntoNextWeek } = bar;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        gridColumn: `${startCol + 1} / span ${span}`,
        gridRow: bar.lane + 1,
      }}
      className={cn(
        "pointer-events-auto group relative mx-0.5 min-h-[46px] w-full border border-border/80 bg-card px-2.5 py-2 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
        "transition-[box-shadow,transform,border-color] duration-150",
        "hover:-translate-y-px hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        continuesFromPreviousWeek ? "ml-0 rounded-l-lg border-l-border/80" : "rounded-l-xl",
        continuesIntoNextWeek ? "mr-0 rounded-r-lg border-r-border/80" : "rounded-r-xl",
      )}
      title={`${service.title} · turno da ${formatShift(service.scheduledShift)}`}
    >
      <p className="truncate text-xs font-semibold text-foreground">{service.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
        Turno da {formatShift(service.scheduledShift)}
      </p>
    </button>
  );
}
