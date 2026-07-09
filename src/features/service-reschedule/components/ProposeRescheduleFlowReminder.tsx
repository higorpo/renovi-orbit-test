import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProposeRescheduleFlowReminderProps {
  onDismiss: () => void;
  className?: string;
}

export function ProposeRescheduleFlowReminder({
  onDismiss,
  className,
}: ProposeRescheduleFlowReminderProps) {
  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/70 bg-muted/35 pl-3 pr-2 py-3",
        className,
      )}
    >
      <div className="flex gap-2.5 pr-8">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            Como funciona o reagendamento?
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Você propõe a nova data; o cliente confirma. Só depois disso a data oficial muda. Até
            lá, o agendamento atual continua valendo.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar lembrete de reagendamento"
        className={cn(
          "absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-md",
          "text-muted-foreground transition-[transform,colors] duration-150 ease-out",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:scale-[0.97]",
        )}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
