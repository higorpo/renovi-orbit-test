import { useBreakpointMd } from "@/hooks/useBreakpoint";

const PAGE_TITLE = "Calendário";
const PAGE_SUBTITLE = "Visualize seus serviços agendados por dia ou por mês";

export function ProviderCalendarHeader() {
  const isDesktop = useBreakpointMd();

  if (!isDesktop) {
    return null;
  }

  return (
    <header className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {PAGE_TITLE}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{PAGE_SUBTITLE}</p>
      </div>
    </header>
  );
}
