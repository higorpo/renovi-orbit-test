const PAGE_TITLE = "Meus serviços";
const PAGE_SUBTITLE =
  "Acompanhe propostas enviadas e serviços em andamento";

export function ProviderMyServicesHeader() {
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
