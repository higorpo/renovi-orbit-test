import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";

export type EarningsEmptyStateProps = {
  hasFilters: boolean;
  onClearFilters?: () => void;
};

export function EarningsEmptyState({ hasFilters, onClearFilters }: EarningsEmptyStateProps) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhuma liquidação neste filtro"
        description="Tente outro filtro ou limpe a seleção para ver todos os ganhos."
        onClearFilters={onClearFilters}
        ariaLabel="Nenhuma liquidação com os filtros aplicados"
      />
    );
  }

  return (
    <EmptyState
      icon={Wallet}
      title="Nenhuma liquidação neste período"
      description="Quando houver depósitos previstos ou liquidados neste período, eles aparecem aqui."
      ariaLabel="Nenhuma liquidação neste período"
    />
  );
}
