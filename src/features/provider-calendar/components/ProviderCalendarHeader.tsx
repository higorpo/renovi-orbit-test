const PAGE_TITLE = "Calendário";
const PAGE_SUBTITLE = "Visualize seus serviços agendados por dia ou por mês";

export function ProviderCalendarHeader() {
  return (
    <header className="hidden space-y-2 md:block">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {PAGE_TITLE}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{PAGE_SUBTITLE}</p>
      </div>
    </header>
  );
}
