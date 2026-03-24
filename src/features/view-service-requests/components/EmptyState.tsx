import { Link } from "react-router";
import { EmptyState as EmptyStateUi } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus } from "lucide-react";
import { ROUTE_REQUEST_QUOTE } from "../constants/routes";

const TITLE = "Você ainda não solicitou nenhum serviço";
const SUPPORT_TEXT =
  "Crie seu primeiro serviço para começar a receber orçamentos de profissionais.";
const CTA_LABEL = "Solicitar serviço";

export function EmptyState() {
  return (
    <EmptyStateUi
      icon={ClipboardList}
      title={TITLE}
      description={SUPPORT_TEXT}
      paddingY="comfortable"
      ariaLabel="Nenhum serviço encontrado"
      action={
        <Button asChild className="gap-2">
          <Link to={ROUTE_REQUEST_QUOTE}>
            <Plus className="h-4 w-4" aria-hidden />
            {CTA_LABEL}
          </Link>
        </Button>
      }
    />
  );
}
