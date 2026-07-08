import { formatShift } from "@/lib/utils/formatShift";
import type { ScheduledServiceDayItem } from "../types/provider-calendar.types";
import { cn } from "@/lib/utils";

const SPAN_LABELS: Record<ScheduledServiceDayItem["spanPosition"], string | null> = {
  single: null,
  start: "Início",
  middle: "Continua",
  end: "Último dia",
};

export interface CalendarServiceChipProps {
  item: ScheduledServiceDayItem;
  onOpen: () => void;
  compact?: boolean;
}

export function CalendarServiceChip({ item, onOpen, compact = false }: CalendarServiceChipProps) {
  const { service, spanPosition } = item;
  const spanLabel = SPAN_LABELS[spanPosition];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group w-full rounded-xl border border-border/80 bg-card text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-[box-shadow,transform,border-color] duration-150",
        "hover:-translate-y-px hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        compact ? "px-2.5 py-2" : "px-3.5 py-3",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
          {service.title}
        </p>
        {spanLabel ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {spanLabel}
          </span>
        ) : null}
      </div>
      <p className={cn("mt-1 text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
        Turno da {formatShift(service.scheduledShift)}
      </p>
    </button>
  );
}
