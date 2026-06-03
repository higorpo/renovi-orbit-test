import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptText, Search } from "lucide-react";

interface ClientBudgetsEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function ClientBudgetsEmptyState({
  hasFilters,
  onClearFilters,
}: ClientBudgetsEmptyStateProps) {
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
      icon={ReceiptText}
      title="Nenhum orçamento recebido ainda"
      description="Quando prestadores enviarem orçamentos para seus pedidos, eles aparecerão aqui."
      ariaLabel="Nenhum orçamento recebido"
    />
  );
}
