import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";
import { ROUTE_REQUEST_QUOTE } from "../constants/routes";

const TITLE = "Você ainda não solicitou nenhum serviço";
const SUPPORT_TEXT =
  "Crie seu primeiro serviço para começar a receber propostas de profissionais";
const CTA_LABEL = "Solicitar serviço";

export function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-12 text-center"
      role="status"
      aria-label="Nenhum serviço encontrado"
    >
      <FileQuestion
        className="h-12 w-12 text-muted-foreground sm:h-14 sm:w-14"
        aria-hidden
      />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{TITLE}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {SUPPORT_TEXT}
      </p>
      <Button asChild className="mt-6">
        <Link to={ROUTE_REQUEST_QUOTE}>{CTA_LABEL}</Link>
      </Button>
    </div>
  );
}
