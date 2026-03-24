import { EmptyState } from "@/components/ui/empty-state";
import { Briefcase, MapPin } from "lucide-react";

export interface JobsEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function JobsEmptyState({ hasFilters, onClearFilters }: JobsEmptyStateProps) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Nenhum trabalho encontrado"
        description="Tente ajustar os filtros ou aumentar o raio de busca para encontrar mais oportunidades."
        onClearFilters={onClearFilters}
        ariaLabel="Nenhum trabalho com os filtros aplicados"
      />
    );
  }

  return (
    <EmptyState
      icon={MapPin}
      title="Nenhuma oportunidade na sua região"
      description="Não encontramos pedidos abertos compatíveis com seus serviços e área de atendimento. Novas oportunidades aparecerão aqui assim que surgirem."
      ariaLabel="Nenhuma oportunidade na região"
    />
  );
}
