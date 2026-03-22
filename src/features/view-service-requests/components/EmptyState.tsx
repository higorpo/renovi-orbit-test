import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus } from "lucide-react";
import { ROUTE_REQUEST_QUOTE } from "../constants/routes";

const TITLE = "Você ainda não solicitou nenhum serviço";
const SUPPORT_TEXT =
  "Crie seu primeiro serviço para começar a receber orçamentos de profissionais.";
const CTA_LABEL = "Solicitar serviço";

export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-14 text-center shadow-sm"
      role="status"
      aria-label="Nenhum serviço encontrado"
    >
      <div className="rounded-full bg-muted/60 p-4">
        <ClipboardList
          className="h-10 w-10 text-muted-foreground sm:h-12 sm:w-12"
          aria-hidden
        />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground sm:text-xl">
        {TITLE}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {SUPPORT_TEXT}
      </p>
      <Button asChild className="mt-7 gap-2">
        <Link to={ROUTE_REQUEST_QUOTE}>
          <Plus className="h-4 w-4" aria-hidden />
          {CTA_LABEL}
        </Link>
      </Button>
    </div>
  );
}
