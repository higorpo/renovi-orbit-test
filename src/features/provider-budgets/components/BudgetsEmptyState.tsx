import { EmptyState } from "@/components/ui/empty-state";
import { FileText, Search } from "lucide-react";

export interface BudgetsEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function BudgetsEmptyState({
  hasFilters,
  onClearFilters,
}: BudgetsEmptyStateProps) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={Search}
        title="Nenhum resultado encontrado"
        description="Tente ajustar os filtros ou a busca para encontrar o que procura."
        onClearFilters={onClearFilters}
        ariaLabel="Nenhum resultado com os filtros aplicados"
      />
    );
  }

  return (
    <EmptyState
      icon={FileText}
      title="Você ainda não enviou nenhum orçamento"
      description="Quando você enviar orçamentos para pedidos de serviço, eles aparecerão aqui para você acompanhar."
      ariaLabel="Nenhum orçamento enviado"
    />
  );
}
