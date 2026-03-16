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
    <header className="space-y-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {PAGE_TITLE}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{PAGE_SUBTITLE}</p>
        </div>
        <Button asChild className="w-full sm:w-auto shrink-0 bg-accent hover:bg-accent/90" size="default">
          <Link to={ROUTE_REQUEST_QUOTE}>
            <Plus className="h-4 w-4" aria-hidden />
            {CTA_LABEL}
          </Link>
        </Button>
      </div>
    </header>
  );
}
