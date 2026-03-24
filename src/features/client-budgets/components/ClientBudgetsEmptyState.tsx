import { EmptyState } from "@/components/ui/empty-state";
import { MessageCircleQuestion, ReceiptText, Search } from "lucide-react";
import type { ClientBudgetsTab } from "../types/client-budgets.types";

interface ClientBudgetsEmptyStateProps {
  tab: ClientBudgetsTab;
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function ClientBudgetsEmptyState({
  tab,
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

  if (tab === "recebidos") {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Nenhum orçamento recebido ainda"
        description="Quando prestadores enviarem orçamentos para seus pedidos, eles aparecerão aqui."
        ariaLabel="Nenhum orçamento recebido"
      />
    );
  }

  return (
    <EmptyState
      icon={MessageCircleQuestion}
      title="Nenhuma pergunta recebida ainda"
      description="Perguntas enviadas por prestadores sobre seus pedidos aparecerão aqui para resposta."
      ariaLabel="Nenhuma pergunta recebida"
    />
  );
}
