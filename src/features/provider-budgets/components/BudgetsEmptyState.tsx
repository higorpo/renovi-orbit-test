import { EmptyState } from "@/components/ui/empty-state";
import { FileText, MessageCircleQuestion, Search } from "lucide-react";
import type { BudgetsTab } from "../types/provider-budgets.types";

export interface BudgetsEmptyStateProps {
  tab: BudgetsTab;
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function BudgetsEmptyState({
  tab,
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

  if (tab === "enviados") {
    return (
      <EmptyState
        icon={FileText}
        title="Você ainda não enviou nenhum orçamento"
        description="Quando você enviar orçamentos para pedidos de serviço, eles aparecerão aqui para você acompanhar."
        ariaLabel="Nenhum orçamento enviado"
      />
    );
  }

  return (
    <EmptyState
      icon={MessageCircleQuestion}
      title="Você ainda não enviou nenhuma pergunta"
      description="Quando você fizer perguntas sobre pedidos de serviço, elas aparecerão aqui para você acompanhar as respostas."
      ariaLabel="Nenhuma pergunta enviada"
    />
  );
}
