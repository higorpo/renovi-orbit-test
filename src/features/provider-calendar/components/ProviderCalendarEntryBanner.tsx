import { Link } from "react-router";
import { CalendarDays, ChevronRight } from "lucide-react";
import { ROUTE_PROVIDER_CALENDAR } from "../constants/routes";

export function ProviderCalendarEntryBanner() {
  return (
    <Link
      to={ROUTE_PROVIDER_CALENDAR}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-px hover:border-primary/25 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Ver calendário de serviços</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Acompanhe sua agenda por dia ou mês, com turnos de manhã, tarde e dia inteiro.
          </p>
        </div>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </Link>
  );
}
