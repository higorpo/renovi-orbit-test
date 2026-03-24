import { EmptyState } from "@/components/ui/empty-state";
import { FilterX } from "lucide-react";

const TITLE = "Nenhum serviço encontrado";
const SUPPORT_TEXT =
  "Nenhum serviço corresponde aos filtros aplicados. Tente alterar ou limpar os filtros para ver mais resultados.";

export interface NoFilterResultsStateProps {
  /** When provided, shows a "Limpar filtros" button that calls this. */
  onClearFilters?: () => void;
}

export function ClientMyServicesNoFilterResultsState({
  onClearFilters,
}: NoFilterResultsStateProps) {
  return (
    <EmptyState
      icon={FilterX}
      title={TITLE}
      description={SUPPORT_TEXT}
      descriptionMaxWidth="md"
      onClearFilters={onClearFilters}
      clearFiltersLabel="Limpar filtros"
      ClearFiltersIcon={FilterX}
      ariaLabel="Nenhum serviço encontrado com os filtros aplicados"
    />
  );
}
