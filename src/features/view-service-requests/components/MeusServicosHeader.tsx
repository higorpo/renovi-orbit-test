import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ROUTE_REQUEST_QUOTE } from "../constants/routes";

const PAGE_TITLE = "Meus serviços";
const PAGE_SUBTITLE =
  "Acompanhe e gerencie os serviços que você solicitou";
const CTA_LABEL = "Novo serviço";

export function MeusServicosHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{PAGE_SUBTITLE}</p>
        </div>
        <Button
          asChild
          className="hidden w-full shrink-0 bg-accent hover:bg-accent/90 sm:inline-flex sm:w-auto"
          size="default"
        >
          <Link to={ROUTE_REQUEST_QUOTE}>
            <Plus className="h-4 w-4" aria-hidden />
            {CTA_LABEL}
          </Link>
        </Button>
      </div>

      {/* Floating action button: visible only on mobile, above bottom nav */}
      <Link
        to={ROUTE_REQUEST_QUOTE}
        aria-label={CTA_LABEL}
        className="fixed right-6 z-50 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:bg-accent/90 hover:scale-105 active:scale-95 sm:hidden bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
      >
        <Plus className="h-6 w-6" aria-hidden />
      </Link>
    </header>
  );
}
