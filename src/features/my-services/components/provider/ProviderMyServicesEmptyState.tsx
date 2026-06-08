import { Link } from "react-router";
import { EmptyState as EmptyStateUi } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";

const TITLE = "Você ainda não enviou propostas";
const SUPPORT_TEXT =
  "Quando você enviar propostas para pedidos, elas aparecerão aqui para acompanhamento.";
const CTA_LABEL = "Ver trabalhos";

export function ProviderMyServicesEmptyState() {
  return (
    <EmptyStateUi
      icon={Briefcase}
      title={TITLE}
      description={SUPPORT_TEXT}
      paddingY="comfortable"
      ariaLabel="Nenhum serviço encontrado"
      action={
        <Button asChild className="gap-2">
          <Link to="/dashboard/jobs">
            <Briefcase className="h-4 w-4" aria-hidden />
            {CTA_LABEL}
          </Link>
        </Button>
      }
    />
  );
}
